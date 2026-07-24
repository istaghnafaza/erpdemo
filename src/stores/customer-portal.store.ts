// =============================================================================
// Customer Portal Store — akun, order online, keranjang (localStorage demo).
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { allowMockDataSeeding } from "@/lib/mock-data-guard";
import {
  getSeedOnlineOrders,
  getSeedPortalAccounts,
  getSeedPortalConfig,
} from "@/lib/mock-customer-portal";
import type {
  CustomerPortalAccount,
  CustomerPortalConfig,
  OnlineOrder,
  OnlineOrderStatus,
  PortalCartItem,
  PortalPaymentMethod,
  RegisterPortalAccountDraft,
  SubmitOnlineOrderDraft,
} from "@/types/customer-portal";

/** Stable empty cart reference — avoids Zustand selector infinite re-renders. */
export const EMPTY_PORTAL_CART: PortalCartItem[] = [];

interface CustomerPortalState {
  config: CustomerPortalConfig;
  accounts: CustomerPortalAccount[];
  orders: OnlineOrder[];
  /** tenantId → accountId */
  sessionByTenant: Record<string, string>;
  /** tenantId → cart items */
  cartsByTenant: Record<string, PortalCartItem[]>;
  /** tenantId → selected branchId */
  branchByTenant: Record<string, string>;

  seedIfEmpty: () => void;
  getConfig: (tenantId: string) => CustomerPortalConfig | null;
  getSession: (tenantId: string) => CustomerPortalAccount | null;
  login: (
    tenantId: string,
    email: string,
    password: string,
  ) => { ok: boolean; error?: string; account?: CustomerPortalAccount };
  register: (
    draft: RegisterPortalAccountDraft,
  ) => { ok: boolean; error?: string; account?: CustomerPortalAccount };
  logout: (tenantId: string) => void;
  getCart: (tenantId: string) => PortalCartItem[];
  setBranch: (tenantId: string, branchId: string) => void;
  getBranchId: (tenantId: string) => string | null;
  addToCart: (tenantId: string, item: PortalCartItem) => void;
  updateCartQty: (tenantId: string, productId: string, qty: number) => void;
  removeFromCart: (tenantId: string, productId: string) => void;
  clearCart: (tenantId: string) => void;
  submitOrder: (
    draft: SubmitOnlineOrderDraft,
  ) => { ok: boolean; error?: string; order?: OnlineOrder };
  listOrdersForAccount: (tenantId: string, accountId: string) => OnlineOrder[];
  listOrdersForTenant: (tenantId: string, branchId?: string | null) => OnlineOrder[];
  approveOrder: (orderId: string) => { ok: boolean; error?: string };
  rejectOrder: (orderId: string) => { ok: boolean; error?: string };
  uploadPaymentProof: (
    orderId: string,
    note: string,
  ) => { ok: boolean; error?: string };
  confirmPayment: (orderId: string) => { ok: boolean; error?: string };
  updateOrderStatus: (
    orderId: string,
    status: OnlineOrderStatus,
  ) => { ok: boolean; error?: string };
  countPendingForBranch: (tenantId: string, branchId: string) => number;
}

let nextAccountId = 100;
let nextOrderId = 100;
let orderSeq = 10;

function nextAccountIdStr(): string {
  nextAccountId += 1;
  return `88889999-0000-0000-0000-${String(nextAccountId).padStart(12, "0")}`;
}

function nextOrderIdStr(): string {
  nextOrderId += 1;
  return `99999999-0000-0000-0000-${String(nextOrderId).padStart(12, "0")}`;
}

function nextOrderNumber(): string {
  orderSeq += 1;
  return `ORD-${new Date().getFullYear()}-${String(orderSeq).padStart(4, "0")}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function initialOrderStatus(
  account: CustomerPortalAccount,
  paymentMethod: PortalPaymentMethod,
): OnlineOrder["status"] {
  if (account.status === "member_tempo" && paymentMethod === "tempo") {
    return "processing";
  }
  return "pending_approval";
}

export const useCustomerPortalStore = create<CustomerPortalState>()(
  persist(
    (set, get) => ({
      config: getSeedPortalConfig(),
      accounts: [],
      orders: [],
      sessionByTenant: {},
      cartsByTenant: {},
      branchByTenant: {},

      seedIfEmpty: () => {
        if (!allowMockDataSeeding()) return;
        const s = get();
        const patch: Partial<CustomerPortalState> = {};
        if (!s.config?.tenantId || !s.config.isActive) {
          patch.config = getSeedPortalConfig();
        }
        if (s.accounts.length === 0) patch.accounts = getSeedPortalAccounts();
        if (s.orders.length === 0) patch.orders = getSeedOnlineOrders();
        if (Object.keys(patch).length > 0) set(patch);
      },

      getConfig: (tenantId) => {
        const cfg = get().config;
        return cfg.tenantId === tenantId && cfg.isActive ? cfg : null;
      },

      getSession: (tenantId) => {
        const accountId = get().sessionByTenant[tenantId];
        if (!accountId) return null;
        return get().accounts.find((a) => a.id === accountId && a.tenantId === tenantId) ?? null;
      },

      login: (tenantId, email, password) => {
        const account = get().accounts.find(
          (a) =>
            a.tenantId === tenantId &&
            normalizeEmail(a.email) === normalizeEmail(email) &&
            a.password === password,
        );
        if (!account) return { ok: false, error: "Email atau password salah" };
        if (account.status === "blocked") {
          return { ok: false, error: "Akun diblokir — hubungi toko" };
        }
        set((s) => ({
          sessionByTenant: { ...s.sessionByTenant, [tenantId]: account.id },
        }));
        return { ok: true, account };
      },

      register: (draft) => {
        if (!draft.name.trim()) return { ok: false, error: "Nama wajib diisi" };
        if (!draft.email.trim()) return { ok: false, error: "Email wajib diisi" };
        if (!draft.password.trim()) return { ok: false, error: "Password wajib diisi" };

        const exists = get().accounts.some(
          (a) =>
            a.tenantId === draft.tenantId &&
            normalizeEmail(a.email) === normalizeEmail(draft.email),
        );
        if (exists) return { ok: false, error: "Email sudah terdaftar" };

        const account: CustomerPortalAccount = {
          id: nextAccountIdStr(),
          tenantId: draft.tenantId,
          name: draft.name.trim(),
          email: draft.email.trim(),
          phone: draft.phone.trim(),
          password: draft.password,
          status: "new",
          creditLimit: 0,
          paymentTermDays: 0,
          outstandingDebt: 0,
          internalCustomerId: null,
          createdAt: new Date().toISOString(),
        };

        set((s) => ({
          accounts: [...s.accounts, account],
          sessionByTenant: { ...s.sessionByTenant, [draft.tenantId]: account.id },
        }));

        return { ok: true, account };
      },

      logout: (tenantId) => {
        set((s) => {
          const next = { ...s.sessionByTenant };
          delete next[tenantId];
          return { sessionByTenant: next };
        });
      },

      getCart: (tenantId) => get().cartsByTenant[tenantId] ?? EMPTY_PORTAL_CART,

      setBranch: (tenantId, branchId) => {
        set((s) => ({
          branchByTenant: { ...s.branchByTenant, [tenantId]: branchId },
        }));
      },

      getBranchId: (tenantId) => get().branchByTenant[tenantId] ?? null,

      addToCart: (tenantId, item) => {
        if (item.stockLabel === "out") return;
        set((s) => {
          const cart = [...(s.cartsByTenant[tenantId] ?? [])];
          const idx = cart.findIndex((c) => c.productId === item.productId);
          if (idx >= 0) {
            cart[idx] = { ...cart[idx], qty: cart[idx].qty + item.qty };
          } else {
            cart.push(item);
          }
          return { cartsByTenant: { ...s.cartsByTenant, [tenantId]: cart } };
        });
      },

      updateCartQty: (tenantId, productId, qty) => {
        set((s) => {
          const cart = (s.cartsByTenant[tenantId] ?? [])
            .map((c) => (c.productId === productId ? { ...c, qty } : c))
            .filter((c) => c.qty > 0);
          return { cartsByTenant: { ...s.cartsByTenant, [tenantId]: cart } };
        });
      },

      removeFromCart: (tenantId, productId) => {
        set((s) => ({
          cartsByTenant: {
            ...s.cartsByTenant,
            [tenantId]: (s.cartsByTenant[tenantId] ?? []).filter(
              (c) => c.productId !== productId,
            ),
          },
        }));
      },

      clearCart: (tenantId) => {
        set((s) => ({
          cartsByTenant: { ...s.cartsByTenant, [tenantId]: [] },
        }));
      },

      submitOrder: (draft) => {
        const account = get().accounts.find((a) => a.id === draft.customerAccountId);
        if (!account) return { ok: false, error: "Sesi login tidak valid" };
        if (draft.items.length === 0) return { ok: false, error: "Keranjang kosong" };
        if (!draft.deliveryAddress.trim()) {
          return { ok: false, error: "Alamat pengiriman wajib diisi" };
        }

        const subtotal = draft.items.reduce((s, i) => s + i.subtotal, 0);
        const now = new Date().toISOString();
        const order: OnlineOrder = {
          id: nextOrderIdStr(),
          tenantId: draft.tenantId,
          branchId: draft.branchId,
          branchName: draft.branchName,
          orderNumber: nextOrderNumber(),
          customerAccountId: draft.customerAccountId,
          customerName: draft.customerName,
          customerPhone: draft.customerPhone,
          items: draft.items,
          deliveryAddress: draft.deliveryAddress.trim(),
          notes: draft.notes.trim(),
          subtotal,
          grandTotal: subtotal,
          paymentMethod: draft.paymentMethod,
          paymentStatus: draft.paymentMethod === "tempo" ? "unpaid" : "unpaid",
          paymentProofNote: null,
          paymentProofUploadedAt: null,
          paymentConfirmedAt: null,
          status: initialOrderStatus(account, draft.paymentMethod),
          salesOrderId: null,
          createdAt: now,
          updatedAt: now,
        };

        set((s) => ({
          orders: [order, ...s.orders],
          cartsByTenant: { ...s.cartsByTenant, [draft.tenantId]: [] },
        }));

        return { ok: true, order };
      },

      listOrdersForAccount: (tenantId, accountId) =>
        get()
          .orders.filter(
            (o) => o.tenantId === tenantId && o.customerAccountId === accountId,
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

      listOrdersForTenant: (tenantId, branchId) =>
        get()
          .orders.filter(
            (o) =>
              o.tenantId === tenantId && (!branchId || o.branchId === branchId),
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

      approveOrder: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order tidak ditemukan" };
        if (order.status !== "pending_approval") {
          return { ok: false, error: "Order tidak bisa disetujui pada status ini" };
        }
        const nextStatus: OnlineOrderStatus =
          order.paymentMethod === "tempo" ? "processing" : "approved";
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, status: nextStatus, updatedAt: new Date().toISOString() }
              : o,
          ),
        }));
        return { ok: true };
      },

      rejectOrder: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order tidak ditemukan" };
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, status: "rejected", updatedAt: new Date().toISOString() }
              : o,
          ),
        }));
        return { ok: true };
      },

      uploadPaymentProof: (orderId, note) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order tidak ditemukan" };
        if (order.status !== "approved") {
          return { ok: false, error: "Order belum disetujui toko" };
        }
        if (!note.trim()) return { ok: false, error: "Catatan bukti wajib diisi" };
        const now = new Date().toISOString();
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: "payment_uploaded",
                  paymentStatus: "proof_uploaded",
                  paymentProofNote: note.trim(),
                  paymentProofUploadedAt: now,
                  updatedAt: now,
                }
              : o,
          ),
        }));
        return { ok: true };
      },

      confirmPayment: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order tidak ditemukan" };
        if (order.status !== "payment_uploaded") {
          return { ok: false, error: "Belum ada bukti pembayaran" };
        }
        const now = new Date().toISOString();
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: "processing",
                  paymentStatus: "confirmed",
                  paymentConfirmedAt: now,
                  updatedAt: now,
                }
              : o,
          ),
        }));
        return { ok: true };
      },

      updateOrderStatus: (orderId, status) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: "Order tidak ditemukan" };
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, status, updatedAt: new Date().toISOString() }
              : o,
          ),
        }));
        return { ok: true };
      },

      countPendingForBranch: (tenantId, branchId) =>
        get().orders.filter(
          (o) =>
            o.tenantId === tenantId &&
            o.branchId === branchId &&
            ["pending_approval", "payment_uploaded"].includes(o.status),
        ).length,
    }),
    {
      name: "ses-customer-portal",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (!allowMockDataSeeding()) return;
        if (state && (!state.config?.tenantId || !state.config.isActive)) {
          state.config = getSeedPortalConfig();
        }
        if (allowMockDataSeeding()) state?.seedIfEmpty();
      },
    },
  ),
);

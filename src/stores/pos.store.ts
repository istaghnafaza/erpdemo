// =============================================================================
// POS Store — cashier sessions, multi-cart, payment processing
//
// NOT persisted to localStorage (session is volatile by design).
// Offline transactions go through offline.store.ts → OfflineTxQueue.
//
// Demo mode (loginAsMock, tenantId === MOCK_TENANT_ID): the mock tenant has
// no real Supabase Auth JWT, so RLS blocks every write (cashier_sessions,
// sales_transactions, branch_products, customers). All session/stock/debt
// state for the mock tenant is therefore kept in-memory in this store —
// same pattern already used by branch.store.ts (MOCK_BRANCHES) and
// mock-notifications.ts. Real tenants go through the full Supabase write
// path unchanged. See usePos.ts for how catalog/customer data is merged
// with the deltas tracked here.
// =============================================================================

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  openSession as apiOpenSession,
  getOpenSession as apiGetOpenSession,
  closeSession as apiCloseSession,
  updateCart,
  createTransaction,
  generateTransactionNumber,
  getNextLocalTransactionSequence,
  isAtomicPosBackend,
} from "@/lib/api/transactions";
import { adjustStock } from "@/lib/api/inventory";
import { updateCustomer } from "@/lib/api/customers";
import { useOfflineStore } from "@/stores/offline.store";
import { useFinanceStore } from "@/stores/finance.store";
import { useReceivablesStore } from "@/stores/receivables.store";
import { useBranchStore } from "@/stores/branch.store";
import { useSalesTransactionsStore } from "@/stores/sales-transactions.store";
import { invalidateResponseCache } from "@/lib/api/response-cache";
import { invalidatePosAfterCheckout } from "@/lib/invalidate-pos-queries";
import { repriceCartItems } from "@/lib/apply-cart-pricing";
import type { PricingBundle } from "@/types/pricing";
import { useNotificationStore } from "@/stores/notification.store";
import { useDeliveriesStore } from "@/stores/deliveries.store";
import { useCustomerDeliverySitesStore } from "@/stores/customer-delivery-sites.store";
import {
  listActiveSitesForCustomer,
  pickPreferredDeliverySite,
  resolveDeliveryAddress,
} from "@/lib/customer-delivery-utils";
import { resolveCashAccountForPayment } from "@/lib/mock-finance";
import { MOCK_TENANT_ID, useAuthStore } from "@/stores/auth.store";
import { isNeonBackend } from "@/lib/api/backend";
import { checkTenantOperational } from "@/lib/plan-guard";
import { buildPosCheckoutExtras } from "@/lib/build-pos-checkout-extras";
import { isMockTenantId } from "@/lib/mock-session";
import type { CashierSession, PosCart, Customer, CartItem } from "@/types/database";
import type { PaymentMethod } from "@/types/app";
import type { OrderFulfillmentType } from "@/types/sales-transactions";
import type { PartialShipLine } from "@/lib/pos-partial-shipment";
import { syncPartialShipLines, validatePartialShipment } from "@/lib/pos-partial-shipment";
import { orderRequiresPhysicalDelivery } from "@/lib/sales-transaction-utils";
import {
  allocateCartDiscountToSoLines,
  allocateDownPaymentToSo,
  cartItemsToSoDrafts,
  cartStockLines,
  hasCartSoLines,
  isCartSoLine,
} from "@/lib/pos-so-checkout";
import type { PosReturnOffset } from "@/lib/pos-return-offset";
import { useSalesOrdersStore } from "@/stores/sales-orders.store";
import { usePosHeldCartsStore } from "@/stores/pos-held-carts.store";
import { buildHandoverLinesFromCart, type HandoverLine } from "@/lib/handover-doc";

// ---------------------------------------------------------------------------
// Internal cart representation (what the store holds per slot)
// ---------------------------------------------------------------------------

export interface ActiveCart {
  cartData: PosCart | null; // null until persisted to DB
  items: CartItem[];
  customer: Customer | null;
  discount: number; // percent, 0–100
  notes: string;
  orderFulfillmentType: OrderFulfillmentType;
  /** Parallel to items — dipakai saat orderFulfillmentType === partial_shipped */
  partialShip: PartialShipLine[];
  deliverySiteId: string | null;
  deliverySiteLabel: string | null;
  /** Alamat pengiriman ter-resolve (site / profil / cabang). */
  deliveryAddress: string | null;
  isManualDeliveryAddress: boolean;
  isHeld: boolean;
  heldLabel: string | null; // e.g. "Keranjang 2 — Siti Rahma" (for held/takeover carts)
  /** ID di pos-held-carts.store saat dipublish untuk kasir lain */
  heldRegistryId: string | null;
  /** Retur menunggu offset — dipotong dari transaksi baru */
  returnOffset: PosReturnOffset | null;
}

const EMPTY_CART = (): ActiveCart => ({
  cartData: null,
  items: [],
  customer: null,
  discount: 0,
  notes: "",
  orderFulfillmentType: "cod",
  partialShip: [],
  deliverySiteId: null,
  deliverySiteLabel: null,
  deliveryAddress: null,
  isManualDeliveryAddress: false,
  isHeld: false,
  heldLabel: null,
  heldRegistryId: null,
  returnOffset: null,
});

const MAX_CARTS = 5;

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

export interface PosState {
  // Session
  activeSession: CashierSession | null;
  sessionLoading: boolean;
  sessionError: string | null;

  // Carts (always MAX_CARTS slots, nulls = empty slots)
  carts: ActiveCart[];
  activeCartIndex: number;

  // Payment
  isProcessing: boolean;
  lastReceipt: {
    transactionNumber: string;
    items: CartItem[];
    subtotal: number;
    discountAmount: number;
    grandTotal: number;
    paymentMethod: PaymentMethod;
    amountPaid: number;
    change: number;
    isOffline: boolean;
    orderFulfillmentType: OrderFulfillmentType;
    cashierName: string;
    customerName: string | null;
    deliverySiteLabel: string | null;
    deliveryAddress: string | null;
    branchName: string;
    branchAddress: string | null;
    branchPhone: string | null;
    storeName: string;
    createdAt: string;
    returnOffset?: PosReturnOffset | null;
    customerPhone?: string | null;
    deliveryNumber?: string | null;
    handoverLines?: HandoverLine[];
  } | null;

  // Context (set from outside — from auth + branch stores)
  tenantId: string;
  branchId: string;
  branchName: string;
  branchAddress: string | null;
  branchPhone: string | null;
  storeName: string;
  cashierId: string;
  cashierName: string;
  branchCode: string;
  isMockSession: boolean;

  // Demo-only local overlays (see file header) — keyed by product_id / customer_id
  mockStockDelta: Record<string, number>;
  mockCustomerDebtDelta: Record<string, number>;

  // -----------------------------------------------------------------------
  // Session management
  // -----------------------------------------------------------------------
  initContext(ctx: {
    tenantId: string;
    branchId: string;
    branchName: string;
    branchAddress: string | null;
    branchPhone: string | null;
    storeName: string;
    cashierId: string;
    cashierName: string;
    branchCode: string;
  }): void;
  openSession(openingBalance: number): Promise<boolean>;
  restoreOpenSession(): Promise<boolean>;
  closeSession(actualBalance: number, notes?: string): Promise<boolean>;
  clearSession(): void;

  // -----------------------------------------------------------------------
  // Cart management
  // -----------------------------------------------------------------------
  addCart(): boolean;
  removeCart(index: number): void;
  switchCart(index: number): void;
  holdCart(index: number): void;
  resumeCart(index: number): void;
  clearCart(index: number): void;
  takeoverCart(
    cartId: string,
    items: CartItem[],
    customer: Customer | null,
    label: string,
  ): boolean;

  // -----------------------------------------------------------------------
  // Item management
  // -----------------------------------------------------------------------
  addItemToCart(cartIndex: number, item: CartItem): void;
  updateItemQty(cartIndex: number, itemIndex: number, qty: number): void;
  removeItem(cartIndex: number, itemIndex: number): void;
  setDiscount(cartIndex: number, percent: number): void;
  setCustomer(cartIndex: number, customer: Customer | null): void;
  setDeliverySite(cartIndex: number, siteId: string | null): void;
  setManualDeliveryAddress(cartIndex: number, address: string): void;
  setNotes(cartIndex: number, notes: string): void;
  setOrderFulfillmentType(cartIndex: number, type: OrderFulfillmentType): void;
  setPartialShipLine(
    cartIndex: number,
    itemIndex: number,
    patch: { selected?: boolean; shipQty?: number },
  ): void;
  toggleItemSoLine(cartIndex: number, itemIndex: number): void;
  repriceCart(cartIndex: number, bundle: PricingBundle): void;
  setReturnOffset(cartIndex: number, offset: PosReturnOffset | null): void;

  // -----------------------------------------------------------------------
  // Payment
  // -----------------------------------------------------------------------
  processPayment(
    cartIndex: number,
    paymentMethod: PaymentMethod,
    amountPaid: number,
  ): Promise<{ success: boolean; transactionNumber?: string; change?: number; error?: string }>;

  clearReceipt(): void;

  /** Sinkron piutang POS ↔ modul keuangan saat pembayaran AR tercatat. */
  adjustMockCustomerDebtDelta: (customerId: string, delta: number) => void;
}

// ---------------------------------------------------------------------------
// Computed helpers
// ---------------------------------------------------------------------------

function cartSubtotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.subtotal, 0);
}

function cartGrandTotal(items: CartItem[], discountPercent: number): number {
  const sub = cartSubtotal(items);
  return Math.round(sub * (1 - discountPercent / 100));
}

function cartReturnOffsetAmount(cart: ActiveCart): number {
  return cart.returnOffset?.amount ?? 0;
}

function cartNetTotal(cart: ActiveCart): number {
  return Math.max(0, cartGrandTotal(cart.items, cart.discount) - cartReturnOffsetAmount(cart));
}

function applyPartialShipSync(cart: ActiveCart) {
  if (cart.orderFulfillmentType !== "partial_shipped") {
    cart.partialShip = [];
    return;
  }
  cart.partialShip = syncPartialShipLines(cart.items, cart.partialShip);
}

function applyDefaultDeliverySite(cart: ActiveCart, branchAddress: string | null) {
  if (!cart.customer) {
    cart.deliverySiteId = null;
    cart.deliverySiteLabel = null;
    cart.deliveryAddress = null;
    cart.isManualDeliveryAddress = false;
    return;
  }

  cart.isManualDeliveryAddress = false;
  const sites = listActiveSitesForCustomer(
    cart.customer.id,
    useCustomerDeliverySitesStore.getState().sites,
  );
  const lastUsedId = useCustomerDeliverySitesStore
    .getState()
    .getLastUsedSiteId(cart.customer.id);
  const picked = pickPreferredDeliverySite(sites, lastUsedId);
  cart.deliverySiteId = picked?.id ?? null;
  cart.deliverySiteLabel = picked?.label ?? null;
  cart.deliveryAddress = resolveDeliveryAddress(
    picked,
    cart.customer.address,
    branchAddress,
  );
}

/** Bucket a payment method into the 4 session total columns tracked on cashier_sessions. */
function sessionBucketField(
  pm: PaymentMethod,
): "total_cash_sales" | "total_card_sales" | "total_transfer_sales" | "total_credit_sales" {
  if (pm === "cash") return "total_cash_sales";
  if (pm === "card") return "total_card_sales";
  if (pm === "transfer") return "total_transfer_sales";
  if (pm === "credit") return "total_credit_sales";
  return "total_card_sales"; // QRIS variants settle like card (non-cash-drawer)
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePosStore = create<PosState>()(
  immer((set, get) => ({
    // -------------------------------------------------------------------------
    // Initial state
    // -------------------------------------------------------------------------
    activeSession: null,
    sessionLoading: false,
    sessionError: null,
    carts: Array.from({ length: MAX_CARTS }, EMPTY_CART),
    activeCartIndex: 0,
    isProcessing: false,
    lastReceipt: null,
    tenantId: "",
    branchId: "",
    branchName: "",
    branchAddress: null,
    branchPhone: null,
    storeName: "",
    cashierId: "",
    cashierName: "",
    branchCode: "",
    isMockSession: false,
    mockStockDelta: {},
    mockCustomerDebtDelta: {},

    // -------------------------------------------------------------------------
    // initContext — called when cashier logs in / branch changes
    // -------------------------------------------------------------------------
    initContext: ({ tenantId, branchId, branchName, branchAddress, branchPhone, storeName, cashierId, cashierName, branchCode }) => {
      set((s) => {
        if (s.activeSession && s.activeSession.cashier_id !== cashierId) {
          s.activeSession = null;
          s.carts = Array.from({ length: MAX_CARTS }, EMPTY_CART);
          s.activeCartIndex = 0;
        }
        s.tenantId = tenantId;
        s.branchId = branchId;
        s.branchName = branchName;
        s.branchAddress = branchAddress;
        s.branchPhone = branchPhone;
        s.storeName = storeName;
        s.cashierId = cashierId;
        s.cashierName = cashierName;
        s.branchCode = branchCode;
        s.isMockSession = isMockTenantId(tenantId);
      });
    },

    // -------------------------------------------------------------------------
    // restoreOpenSession — reuse existing DB shift (avoid duplicate open sessions)
    // -------------------------------------------------------------------------
    restoreOpenSession: async () => {
      const { tenantId, branchId, cashierId, isMockSession, activeSession } = get();
      if (isMockSession || activeSession || !tenantId || !branchId || !cashierId) {
        return Boolean(activeSession);
      }

      set((s) => {
        s.sessionLoading = true;
        s.sessionError = null;
      });

      try {
        const result = await apiGetOpenSession(tenantId, branchId, cashierId);
        if (result.error) {
          set((s) => {
            s.sessionError = result.error;
            s.sessionLoading = false;
          });
          return false;
        }
        if (result.data) {
          set((s) => {
            s.activeSession = result.data;
            s.sessionLoading = false;
          });
          return true;
        }
        set((s) => {
          s.sessionLoading = false;
        });
        return false;
      } catch (err) {
        set((s) => {
          s.sessionError = err instanceof Error ? err.message : "Gagal memuat sesi";
          s.sessionLoading = false;
        });
        return false;
      }
    },

    // -------------------------------------------------------------------------
    // openSession
    // -------------------------------------------------------------------------
    openSession: async (openingBalance) => {
      const { tenantId, branchId, cashierId, isMockSession } = get();
      if (!tenantId || !branchId || !cashierId) return false;

      set((s) => {
        s.sessionLoading = true;
        s.sessionError = null;
      });

      if (isMockSession) {
        const session: CashierSession = {
          id: `mock-session-${Date.now()}`,
          tenant_id: tenantId,
          branch_id: branchId,
          cashier_id: cashierId,
          status: "open",
          opened_at: new Date().toISOString(),
          closed_at: null,
          opening_cash_balance: openingBalance,
          expected_cash_balance: openingBalance,
          actual_cash_balance: null,
          cash_discrepancy: null,
          total_sales: 0,
          total_cash_sales: 0,
          total_card_sales: 0,
          total_transfer_sales: 0,
          total_credit_sales: 0,
          total_transactions: 0,
          notes: null,
        };
        set((s) => {
          s.activeSession = session;
          s.sessionLoading = false;
          s.carts = Array.from({ length: MAX_CARTS }, EMPTY_CART);
          s.activeCartIndex = 0;
        });
        return true;
      }

      try {
        const result = await apiOpenSession(tenantId, {
          tenant_id: tenantId,
          branch_id: branchId,
          cashier_id: cashierId,
          status: "open",
          opened_at: new Date().toISOString(),
          opening_cash_balance: openingBalance,
          actual_cash_balance: null,
          closed_at: null,
          notes: null,
        });

        if (result.error) {
          set((s) => {
            s.sessionError = result.error;
            s.sessionLoading = false;
          });
          return false;
        }

        set((s) => {
          s.activeSession = result.data;
          s.sessionLoading = false;
          s.carts = Array.from({ length: MAX_CARTS }, EMPTY_CART);
          s.activeCartIndex = 0;
        });
        return true;
      } catch (err) {
        set((s) => {
          s.sessionError = err instanceof Error ? err.message : "Gagal buka sesi";
          s.sessionLoading = false;
        });
        return false;
      }
    },

    // -------------------------------------------------------------------------
    // closeSession
    // -------------------------------------------------------------------------
    closeSession: async (actualBalance, notes) => {
      const { activeSession, tenantId, isMockSession } = get();
      if (!activeSession) return false;

      // Guard: ensure no active paid-pending carts
      const { carts } = get();
      const hasActiveCarts = carts.some((c: ActiveCart) => c.items.length > 0 && !c.isHeld);
      if (hasActiveCarts) return false;

      set((s) => {
        s.sessionLoading = true;
        s.sessionError = null;
      });

      if (isMockSession) {
        set((s) => {
          s.activeSession = null;
          s.sessionLoading = false;
          s.carts = Array.from({ length: MAX_CARTS }, EMPTY_CART);
          s.activeCartIndex = 0;
        });
        return true;
      }

      try {
        const result = await apiCloseSession(tenantId, activeSession.id, actualBalance, notes);
        if (result.error) {
          set((s) => {
            s.sessionError = result.error;
            s.sessionLoading = false;
          });
          return false;
        }

        set((s) => {
          s.activeSession = null;
          s.sessionLoading = false;
          s.carts = Array.from({ length: MAX_CARTS }, EMPTY_CART);
          s.activeCartIndex = 0;
        });
        return true;
      } catch (err) {
        set((s) => {
          s.sessionError = err instanceof Error ? err.message : "Gagal tutup sesi";
          s.sessionLoading = false;
        });
        return false;
      }
    },

    clearSession: () => {
      set((s) => {
        s.activeSession = null;
        s.carts = Array.from({ length: MAX_CARTS }, EMPTY_CART);
        s.activeCartIndex = 0;
      });
    },

    // -------------------------------------------------------------------------
    // addCart — opens a new empty cart slot
    // -------------------------------------------------------------------------
    addCart: () => {
      const { carts } = get();
      const emptySlot = carts.findIndex((c: ActiveCart) => c.items.length === 0 && !c.isHeld);
      if (emptySlot === -1) return false; // all 5 slots in use

      set((s) => {
        s.carts[emptySlot] = EMPTY_CART();
        s.activeCartIndex = emptySlot;
      });
      return true;
    },

    // -------------------------------------------------------------------------
    // removeCart — clears a cart slot (soft delete)
    // -------------------------------------------------------------------------
    removeCart: (index) => {
      set((s) => {
        s.carts[index] = EMPTY_CART();
        // Switch to nearest non-empty slot, or 0
        const next = s.carts.findIndex(
          (c: ActiveCart, i: number) => i !== index && (c.items.length > 0 || c.isHeld),
        );
        s.activeCartIndex = next === -1 ? 0 : next;
      });
    },

    switchCart: (index) => {
      set((s) => {
        s.activeCartIndex = index;
      });
    },

    holdCart: (index) => {
      const { tenantId, branchId, cashierId, cashierName } = get();
      set((s) => {
        const cart = s.carts[index];
        if (cart.items.length === 0) return;

        const registryId = cart.heldRegistryId ?? `held-cart-${Date.now()}`;
        cart.isHeld = true;
        cart.heldRegistryId = registryId;
        if (!cart.heldLabel) {
          cart.heldLabel = `Keranjang ${index + 1} — ${cashierName}`;
        }

        usePosHeldCartsStore.getState().publish({
          id: registryId,
          tenantId,
          branchId,
          cashierId,
          cashierName,
          label: cart.heldLabel,
          customer: cart.customer,
          items: cart.items.map((i) => ({ ...i })),
          discount: cart.discount,
          notes: cart.notes,
          heldAt: new Date().toISOString(),
        });

        const next = s.carts.findIndex(
          (c: ActiveCart, i: number) => i !== index && c.items.length === 0 && !c.isHeld,
        );
        if (next !== -1) s.activeCartIndex = next;
      });
    },

    resumeCart: (index) => {
      set((s) => {
        const registryId = s.carts[index].heldRegistryId;
        if (registryId) {
          usePosHeldCartsStore.getState().remove(registryId);
        }
        s.carts[index].isHeld = false;
        s.carts[index].heldLabel = null;
        s.carts[index].heldRegistryId = null;
        s.activeCartIndex = index;
      });
    },

    clearCart: (index) => {
      set((s) => {
        const registryId = s.carts[index].heldRegistryId;
        if (registryId) {
          usePosHeldCartsStore.getState().remove(registryId);
        }
        s.carts[index] = EMPTY_CART();
      });
    },

    // -------------------------------------------------------------------------
    // takeoverCart — load an existing (held) cart from another cashier
    // -------------------------------------------------------------------------
    takeoverCart: (cartId, items, customer, label) => {
      const { carts, isMockSession } = get();
      const emptySlot = carts.findIndex((c: ActiveCart) => c.items.length === 0 && !c.isHeld);
      if (emptySlot === -1) return false;

      const heldEntry = usePosHeldCartsStore.getState().carts.find((c) => c.id === cartId);

      set((s) => {
        s.carts[emptySlot] = {
          ...EMPTY_CART(),
          items: heldEntry?.items ?? items,
          customer: heldEntry?.customer ?? customer,
          discount: heldEntry?.discount ?? 0,
          notes: heldEntry?.notes ?? "",
        };
        s.activeCartIndex = emptySlot;
      });

      usePosHeldCartsStore.getState().remove(cartId);

      if (!isMockSession && !cartId.startsWith("held-cart-")) {
        void updateCart(get().tenantId, cartId, { cashier_id: get().cashierId });
      }
      void label;
      return true;
    },

    // -------------------------------------------------------------------------
    // addItemToCart
    // -------------------------------------------------------------------------
    addItemToCart: (cartIndex, item) => {
      set((s) => {
        const cart = s.carts[cartIndex];
        const existing = cart.items.findIndex(
          (i: CartItem) =>
            i.product_id === item.product_id &&
            i.stock_source === item.stock_source &&
            !!i.is_so_line === !!item.is_so_line &&
            (i.sell_unit_id ?? null) === (item.sell_unit_id ?? null),
        );

        if (existing !== -1) {
          const cur = cart.items[existing];
          const allowFraction = Boolean(cur.allow_fraction || cur.sell_unit_id);
          const newQty = cur.qty + item.qty;
          const factor = cur.factor_to_base && cur.factor_to_base > 0 ? cur.factor_to_base : 1;
          const newBase = newQty * factor;
          if (!cur.is_so_line && newBase > cur.available_stock + 1e-9) {
            const maxSell = cur.available_stock / factor;
            const clamped = allowFraction
              ? Math.floor(maxSell * 10000) / 10000
              : Math.floor(maxSell);
            if (clamped > 0) {
              cur.qty = clamped;
              cur.qty_base = cur.qty * factor;
              cur.subtotal = (cur.selling_price - cur.discount) * cur.qty;
            }
          } else {
            cur.qty = newQty;
            cur.qty_base = newBase;
            cur.subtotal = (cur.selling_price - cur.discount) * newQty;
          }
        } else {
          cart.items.push({
            ...item,
            is_so_line: item.is_so_line ?? false,
            allow_fraction: Boolean(item.allow_fraction || item.sell_unit_id),
          });
        }
        applyPartialShipSync(cart);
      });
    },

    // -------------------------------------------------------------------------
    // updateItemQty
    // -------------------------------------------------------------------------
    updateItemQty: (cartIndex, itemIndex, qty) => {
      set((s) => {
        const cart = s.carts[cartIndex];
        const item = cart.items[itemIndex];
        if (!item) return;

        const allowFraction = Boolean(item.allow_fraction || item.sell_unit_id);
        const factor = item.factor_to_base && item.factor_to_base > 0 ? item.factor_to_base : 1;

        let safeQty = Number(qty);
        if (!Number.isFinite(safeQty)) return;
        if (!allowFraction) safeQty = Math.floor(safeQty);
        else safeQty = Math.round(safeQty * 10000) / 10000;

        // Hapus hanya jika user set 0 / negatif (bukan karena floor 0.5 → 0)
        if (safeQty <= 0) {
          cart.items.splice(itemIndex, 1);
          cart.partialShip.splice(itemIndex, 1);
          applyPartialShipSync(cart);
          return;
        }

        if (!item.is_so_line) {
          const needBase = safeQty * factor;
          if (needBase > item.available_stock + 1e-9) {
            const maxSell = item.available_stock / factor;
            safeQty = allowFraction
              ? Math.floor(maxSell * 10000) / 10000
              : Math.floor(maxSell);
            if (safeQty <= 0) {
              // Stok tidak cukup — jangan hapus diam-diam; kembalikan ke qty lama
              return;
            }
          }
        }

        item.qty = safeQty;
        item.qty_base = safeQty * factor;
        item.subtotal = (item.selling_price - item.discount) * safeQty;
        applyPartialShipSync(cart);
      });
    },

    removeItem: (cartIndex, itemIndex) => {
      set((s) => {
        s.carts[cartIndex].items.splice(itemIndex, 1);
        s.carts[cartIndex].partialShip.splice(itemIndex, 1);
        applyPartialShipSync(s.carts[cartIndex]);
      });
    },

    setDiscount: (cartIndex, percent) => {
      set((s) => {
        s.carts[cartIndex].discount = Math.max(0, Math.min(100, percent));
      });
    },

    setCustomer: (cartIndex, customer) => {
      set((s) => {
        const cart = s.carts[cartIndex];
        cart.customer = customer;
        const branch =
          useBranchStore.getState().activeBranch ??
          useBranchStore.getState().branches.find((b) => b.id === s.branchId);
        applyDefaultDeliverySite(cart, branch?.address ?? null);
      });
    },

    setDeliverySite: (cartIndex, siteId) => {
      set((s) => {
        const cart = s.carts[cartIndex];
        if (!cart.customer) return;

        const branch =
          useBranchStore.getState().activeBranch ??
          useBranchStore.getState().branches.find((b) => b.id === s.branchId);

        if (!siteId) {
          applyDefaultDeliverySite(cart, branch?.address ?? null);
          return;
        }

        const site = useCustomerDeliverySitesStore
          .getState()
          .sites.find((x) => x.id === siteId && x.customerId === cart.customer!.id);

        if (!site) {
          applyDefaultDeliverySite(cart, branch?.address ?? null);
          return;
        }

        cart.deliverySiteId = site.id;
        cart.deliverySiteLabel = site.label;
        cart.isManualDeliveryAddress = false;
        cart.deliveryAddress = resolveDeliveryAddress(
          site,
          cart.customer.address,
          branch?.address ?? null,
        );
      });
    },

    setManualDeliveryAddress: (cartIndex, address) => {
      set((s) => {
        const cart = s.carts[cartIndex];
        cart.deliverySiteId = null;
        cart.deliverySiteLabel = null;
        cart.isManualDeliveryAddress = true;
        cart.deliveryAddress = address.trim() || null;
      });
    },

    setNotes: (cartIndex, notes) => {
      set((s) => {
        s.carts[cartIndex].notes = notes;
      });
    },

    setOrderFulfillmentType: (cartIndex, type) => {
      set((s) => {
        const cart = s.carts[cartIndex];
        if (type === "cod" && hasCartSoLines(cart.items)) return;
        cart.orderFulfillmentType = type;
        if (type === "partial_shipped") {
          cart.partialShip = cart.items.map(() => ({ selected: false, shipQty: 0 }));
        } else {
          cart.partialShip = [];
        }
        if (!cart.customer) {
          if (orderRequiresPhysicalDelivery(type)) {
            cart.isManualDeliveryAddress = true;
          } else {
            cart.deliveryAddress = null;
            cart.isManualDeliveryAddress = false;
          }
        }
      });
    },

    setPartialShipLine: (cartIndex, itemIndex, patch) => {
      set((s) => {
        const cart = s.carts[cartIndex];
        if (cart.orderFulfillmentType !== "partial_shipped") return;
        const item = cart.items[itemIndex];
        if (!item || isCartSoLine(item)) return;
        applyPartialShipSync(cart);
        const line = cart.partialShip[itemIndex];
        if (!line) return;

        if (patch.selected !== undefined) {
          line.selected = patch.selected;
          if (!patch.selected) {
            line.shipQty = 0;
          } else if (line.shipQty < 1) {
            line.shipQty = 1;
          }
        }

        if (patch.shipQty !== undefined) {
          const qty = Math.max(0, Math.min(item.qty, Math.floor(patch.shipQty)));
          line.shipQty = qty;
          line.selected = qty > 0;
        }
      });
    },

    toggleItemSoLine: (cartIndex, itemIndex) => {
      set((s) => {
        const cart = s.carts[cartIndex];
        const item = cart.items[itemIndex];
        if (!item) return;
        item.is_so_line = !item.is_so_line;
        if (item.is_so_line && cart.orderFulfillmentType === "cod") {
          cart.orderFulfillmentType = "shipped";
        }
        if (item.is_so_line && cart.partialShip[itemIndex]) {
          cart.partialShip[itemIndex] = { selected: false, shipQty: 0 };
        }
        if (!item.is_so_line && item.qty > item.available_stock) {
          item.qty = item.available_stock;
          item.subtotal = (item.selling_price - item.discount) * item.available_stock;
        }
        applyPartialShipSync(cart);
      });
    },

    repriceCart: (cartIndex, bundle) => {
      set((s) => {
        const cart = s.carts[cartIndex];
        if (cart.items.length === 0) return;
        cart.items = repriceCartItems(cart.items, cart.customer, bundle);
        applyPartialShipSync(cart);
      });
    },

    setReturnOffset: (cartIndex, offset) => {
      set((s) => {
        s.carts[cartIndex].returnOffset = offset;
      });
    },

    // -------------------------------------------------------------------------
    // processPayment — the core POS checkout flow
    // -------------------------------------------------------------------------
    processPayment: async (cartIndex, paymentMethod, amountPaid) => {
      const {
        carts,
        activeSession,
        tenantId,
        branchId,
        cashierId,
        branchCode,
        cashierName,
        isMockSession,
      } = get();
      const cart = carts[cartIndex];

      if (!activeSession) return { success: false, error: "Tidak ada sesi aktif" };
      if (cart.items.length === 0) return { success: false, error: "Keranjang kosong" };
      if (!isMockSession) {
        const operational = checkTenantOperational(useAuthStore.getState().currentTenant);
        if (!operational.ok) return { success: false, error: operational.message };
      }

      if (hasCartSoLines(cart.items) && cart.orderFulfillmentType === "cod") {
        return {
          success: false,
          error: "Barang Sales Order tidak bisa dengan keterangan COD — pilih Di Kirim",
        };
      }

      if (cart.orderFulfillmentType === "partial_shipped") {
        const partialCheck = validatePartialShipment(cart.items, cart.partialShip);
        if (!partialCheck.ok) return { success: false, error: partialCheck.error };
      }

      if (orderRequiresPhysicalDelivery(cart.orderFulfillmentType)) {
        const shipAddr = cart.deliveryAddress?.trim();
        if (!shipAddr) {
          return {
            success: false,
            error: "Alamat pengiriman wajib diisi untuk order Di Kirim",
          };
        }
      }

      let createdDeliveryNumber: string | null = null;

      const grossTotal = cartGrandTotal(cart.items, cart.discount);
      const returnOffsetAmount = cartReturnOffsetAmount(cart);
      const grandTotal = cartNetTotal(cart);

      if (returnOffsetAmount > grossTotal) {
        return { success: false, error: "Potongan retur melebihi total belanja" };
      }

      // Credit sale: check customer credit limit (sisa piutang setelah DP)
      if (paymentMethod === "credit") {
        if (!cart.customer) return { success: false, error: "Pilih customer untuk kredit" };
        if (cart.customer.type !== "credit")
          return { success: false, error: "Customer bukan tipe kredit" };
        if (amountPaid < 0 || amountPaid > grandTotal)
          return { success: false, error: "DP tidak valid" };
        const creditDebt = grandTotal - amountPaid;
        const currentDebt =
          cart.customer.outstanding_debt + (get().mockCustomerDebtDelta[cart.customer.id] ?? 0);
        const available = cart.customer.credit_limit - currentDebt;
        if (creditDebt > available)
          return { success: false, error: "Melebihi limit kredit customer" };
      }

      set((s) => {
        s.isProcessing = true;
      });

      const subtotal = cartSubtotal(cart.items);
      /** Diskon keranjang (%) — terpisah dari potong retur. */
      const discountAmount = subtotal - grossTotal;
      const changeAmount =
        paymentMethod === "cash" ? Math.max(0, amountPaid - grandTotal) : 0;
      const isOnline = useOfflineStore.getState().isOnline;

      const applySessionTotals = () => {
        set((s) => {
          if (!s.activeSession) return;
          s.activeSession.total_sales += grandTotal;
          s.activeSession.total_transactions += 1;
          if (paymentMethod === "credit") {
            const creditDebt = grandTotal - amountPaid;
            s.activeSession.total_credit_sales += creditDebt;
            if (amountPaid > 0) {
              s.activeSession.total_cash_sales += amountPaid;
              s.activeSession.expected_cash_balance += amountPaid;
            }
          } else {
            const bucket = sessionBucketField(paymentMethod);
            s.activeSession[bucket] += grandTotal;
            if (paymentMethod === "cash") {
              s.activeSession.expected_cash_balance += grandTotal;
            }
          }
        });
      };

      const applyMockDeltas = () => {
        set((s) => {
          for (const item of cartStockLines(cart.items)) {
            const base = item.qty_base ?? item.qty;
            s.mockStockDelta[item.product_id] = (s.mockStockDelta[item.product_id] ?? 0) - base;
          }
          if (paymentMethod === "credit" && cart.customer) {
            const creditDebt = grandTotal - amountPaid;
            if (creditDebt > 0) {
              s.mockCustomerDebtDelta[cart.customer.id] =
                (s.mockCustomerDebtDelta[cart.customer.id] ?? 0) + creditDebt;
            }
          }
        });
      };

      const recordMockFinanceFromSale = (txNumber: string) => {
        if (!isMockSession) return;

        if (paymentMethod === "credit") {
          if (cart.customer) {
            const creditDebt = grandTotal - amountPaid;
            if (amountPaid > 0) {
              const accountId = resolveCashAccountForPayment("cash", branchId);
              if (accountId) {
                useFinanceStore.getState().recordMockIncome({
                  tenant_id: tenantId,
                  branch_id: branchId,
                  cash_account_id: accountId,
                  category: "Penjualan",
                  amount: amountPaid,
                  description: `DP penjualan kredit ${txNumber}`,
                  reference: txNumber,
                  user_id: cashierId,
                });
              }
            }
            if (creditDebt > 0) {
              useReceivablesStore.getState().recordMockCreditSale({
                branch_id: branchId,
                customer_id: cart.customer.id,
                invoice: txNumber,
                amount: creditDebt,
              });
            }
          }
          // HPP & pendapatan penuh dihitung dari histori POS (sales-transactions)
          return;
        }

        const accountId = resolveCashAccountForPayment(paymentMethod, branchId);
        if (!accountId) return;

        useFinanceStore.getState().recordMockIncome({
          tenant_id: tenantId,
          branch_id: branchId,
          cash_account_id: accountId,
          category: "Penjualan",
          amount: grandTotal,
          description: cart.customer
            ? `Penjualan ke ${cart.customer.name}`
            : "Penjualan tunai POS",
          reference: txNumber,
          user_id: cashierId,
        });
      };

      const recordSaleHistory = (txNumber: string, isOffline: boolean) => {
        const branch =
          useBranchStore.getState().activeBranch ??
          useBranchStore.getState().branches.find((b) => b.id === branchId);
        const branchName = branch?.name ?? "Cabang";
        const branchCode = branch?.code ?? "BR";

        const deliveryAddress = cart.deliveryAddress?.trim() || null;

        const sale = useSalesTransactionsStore.getState().recordSale({
          tenantId,
          branchId,
          branchName,
          transactionNumber: txNumber,
          cashierId,
          cashierName,
          customerName: cart.customer?.name ?? null,
          subtotal,
          discountAmount,
          grandTotal,
          paymentMethod,
          amountPaid,
          changeAmount,
          isOffline,
          orderFulfillmentType: cart.orderFulfillmentType,
          deliveryAddress,
          deliverySiteId: cart.deliverySiteId,
          deliverySiteLabel: cart.deliverySiteLabel,
          items: cart.items.map((item) => ({
            productId: item.product_id,
            productName: item.name,
            sku: item.sku,
            unit: item.unit,
            qty: item.qty,
            purchasePrice: item.purchase_price,
            sellingPrice: item.selling_price,
            discount: item.discount,
            subtotal: item.subtotal,
            isSoLine: item.is_so_line ?? false,
          })),
        });

        const shippableEntries = cart.items
          .map((item, idx) => ({ item, idx }))
          .filter(({ item }) => !isCartSoLine(item));

        if (
          orderRequiresPhysicalDelivery(cart.orderFulfillmentType) &&
          shippableEntries.length > 0
        ) {
          if (isMockSession || !isNeonBackend()) {
            const created = useDeliveriesStore.getState().createFromCheckout(
            {
              tenantId,
              branchId,
              branchName,
              salesTransactionId: sale.id,
              transactionNumber: txNumber,
              orderFulfillmentType: cart.orderFulfillmentType,
              cashierId,
              cashierName,
              customerName: cart.customer?.name ?? null,
              customerPhone: cart.customer?.phone ?? null,
              deliveryAddress: deliveryAddress ?? "",
              deliverySiteId: cart.deliverySiteId,
              deliverySiteLabel: cart.deliverySiteLabel,
              paymentMethod,
              grandTotal,
              isOfflineSale: isOffline,
              items: shippableEntries.map(({ item, idx }) => ({
                productId: item.product_id,
                productName: item.name,
                sku: item.sku,
                unit: item.unit,
                qty: item.qty,
                shipQty:
                  cart.orderFulfillmentType === "partial_shipped"
                    ? (cart.partialShip[idx]?.shipQty ?? 0)
                    : item.qty,
              })),
            },
            branchCode,
          );
            if (created?.deliveryNumber) createdDeliveryNumber = created.deliveryNumber;
          }
        }

        if (hasCartSoLines(cart.items)) {
          if (isMockSession || !isNeonBackend()) {
          const { soDiscountAmount, soGrandTotal } = allocateCartDiscountToSoLines(
            cart.items,
            discountAmount,
          );
          const soDownPayment = allocateDownPaymentToSo(
            grandTotal,
            amountPaid,
            soGrandTotal,
            paymentMethod,
          );
          useSalesOrdersStore.getState().createMockOrderFromPosCheckout({
            tenant_id: tenantId,
            branch_id: branchId,
            customer_id: cart.customer?.id ?? null,
            customer_name: cart.customer?.name ?? "Pelanggan Umum",
            delivery_address: deliveryAddress,
            discount_amount: soDiscountAmount,
            down_payment: soDownPayment,
            created_by: cashierId,
            pos_transaction_id: sale.id,
            pos_transaction_number: txNumber,
            items: cartItemsToSoDrafts(cart.items),
          });
          }
        }

        if (cart.deliverySiteId && !cart.isManualDeliveryAddress) {
          const sitesStore = useCustomerDeliverySitesStore.getState();
          sitesStore.recordSiteOrder(cart.deliverySiteId);
          if (cart.customer) {
            sitesStore.recordLastUsedSite(cart.customer.id, cart.deliverySiteId);
          }
        }
      };

      const finalize = (txNumber: string, isOffline: boolean) => {
        applySessionTotals();
        if (cart.heldRegistryId) {
          usePosHeldCartsStore.getState().remove(cart.heldRegistryId);
        }
        set((s) => {
          s.carts[cartIndex] = EMPTY_CART();
          s.isProcessing = false;
          s.lastReceipt = {
            transactionNumber: txNumber,
            items: cart.items,
            subtotal,
            discountAmount,
            grandTotal,
            paymentMethod,
            amountPaid,
            change: changeAmount,
            isOffline,
            orderFulfillmentType: cart.orderFulfillmentType,
            cashierName,
            customerName: cart.customer?.name ?? null,
            deliverySiteLabel: cart.deliverySiteLabel,
            deliveryAddress: cart.deliveryAddress,
            branchName: get().branchName,
            branchAddress: get().branchAddress,
            branchPhone: get().branchPhone,
            storeName: get().storeName,
            createdAt: new Date().toISOString(),
            returnOffset: cart.returnOffset,
            customerPhone: cart.customer?.phone ?? null,
            deliveryNumber: createdDeliveryNumber,
            handoverLines: buildHandoverLinesFromCart(
              cart.items,
              cart.orderFulfillmentType,
              cart.partialShip,
            ),
          };
        });
      };

      // ---------------------------------------------------------------------
      // Offline path (both mock & real tenants): queue locally, sync later.
      // ---------------------------------------------------------------------
      if (!isOnline) {
        const seq = getNextLocalTransactionSequence(branchId);
        const txNumber = generateTransactionNumber(branchCode, new Date(), seq);
        const nowIso = new Date().toISOString();

        await useOfflineStore.getState().addToQueue({
          localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          tenantId,
          branchId,
          sessionId: isMockSession ? null : activeSession.id,
          offlineCreatedAt: nowIso,
          transaction: {
            branch_id: branchId,
            session_id: activeSession.id,
            cart_id: cart.cartData?.id ?? null,
            transaction_number: txNumber,
            customer_id: cart.customer?.id ?? null,
            customer_name: cart.customer?.name ?? null,
            subtotal,
            discount_amount: discountAmount,
            tax_amount: 0,
            grand_total: grandTotal,
            payment_method: paymentMethod,
            qris_provider: null,
            amount_paid: amountPaid,
            change_amount: changeAmount,
            input_by: cashierId,
            paid_by: cashierId,
            is_cross_session: false,
            has_legacy_items: cart.items.some((i) => i.stock_source === "legacy"),
            is_offline_transaction: true,
            offline_created_at: nowIso,
            sync_status: "pending",
            status: "completed",
            notes: cart.notes || null,
          },
          items: cart.items.map((item) => ({
            product_id: item.product_id,
            product_name: item.name,
            sku: item.sku,
            unit: item.unit,
            qty: item.qty,
            purchase_price: item.purchase_price,
            selling_price: item.selling_price,
            discount: item.discount,
            subtotal: item.subtotal,
            stock_source: item.stock_source,
            is_so_line: item.is_so_line === true,
            sell_unit_id: item.sell_unit_id ?? null,
            sell_unit_label: item.sell_unit_label ?? null,
            qty_base: item.qty_base ?? item.qty,
            factor_to_base: item.factor_to_base ?? 1,
          })),
        });

        applyMockDeltas();
        recordMockFinanceFromSale(txNumber);
        recordSaleHistory(txNumber, true);
        finalize(txNumber, true);
        return { success: true, transactionNumber: txNumber, change: changeAmount };
      }

      // ---------------------------------------------------------------------
      // Mock/demo tenant, online: everything stays in-memory (no real backend
      // write is possible — RLS blocks it with no auth.uid()).
      // ---------------------------------------------------------------------
      if (isMockSession) {
        const seq = getNextLocalTransactionSequence(branchId);
        const txNumber = generateTransactionNumber(branchCode, new Date(), seq);
        applyMockDeltas();
        recordMockFinanceFromSale(txNumber);
        recordSaleHistory(txNumber, false);
        finalize(txNumber, false);
        return { success: true, transactionNumber: txNumber, change: changeAmount };
      }

      // ---------------------------------------------------------------------
      // Real tenant, online: full Neon/Supabase write path.
      // Neon: nomor transaksi digenerate server-side (1 round-trip, bukan 2).
      // ---------------------------------------------------------------------
      try {
        const txNumber = isAtomicPosBackend()
          ? ""
          : generateTransactionNumber(branchCode, new Date(), getNextLocalTransactionSequence(branchId));

        const checkoutExtras =
          isNeonBackend() && !isMockSession
            ? buildPosCheckoutExtras({
                tenantId,
                branchId,
                cashierId,
                cart,
                paymentMethod,
                discountAmount,
                grandTotal,
                amountPaid,
                transactionNumber: txNumber || "pending",
              })
            : undefined;

        const txResult = await createTransaction(
          tenantId,
          {
            branch_id: branchId,
            session_id: activeSession.id,
            cart_id: cart.cartData?.id ?? null,
            transaction_number: txNumber,
            customer_id: cart.customer?.id ?? null,
            customer_name: cart.customer?.name ?? null,
            subtotal,
            discount_amount: discountAmount,
            tax_amount: 0,
            grand_total: grandTotal,
            payment_method: paymentMethod,
            qris_provider: null,
            amount_paid: amountPaid,
            change_amount: changeAmount,
            input_by: cashierId,
            paid_by: cashierId,
            is_cross_session: false,
            has_legacy_items: cart.items.some((i) => i.stock_source === "legacy"),
            is_offline_transaction: false,
            offline_created_at: null,
            sync_status: "synced",
            status: "completed",
            notes: cart.notes || null,
          },
          cart.items.map((item) => ({
            product_id: item.product_id,
            product_name: item.name,
            sku: item.sku,
            unit: item.unit,
            qty: item.qty,
            purchase_price: item.purchase_price,
            selling_price: item.selling_price,
            discount: item.discount,
            subtotal: item.subtotal,
            stock_source: item.stock_source,
            is_so_line: item.is_so_line === true,
            sell_unit_id: item.sell_unit_id ?? null,
            sell_unit_label: item.sell_unit_label ?? null,
            qty_base: item.qty_base ?? item.qty,
            factor_to_base: item.factor_to_base ?? 1,
          })),
          checkoutExtras,
        );

        if (txResult.error) {
          set((s) => {
            s.isProcessing = false;
          });
          return { success: false, error: txResult.error };
        }

        const savedTxNumber = txResult.data!.transaction_number;

        if (!isAtomicPosBackend()) {
          // Deduct stock for each item (Supabase non-atomic path)
          for (const item of cartStockLines(cart.items)) {
            const src = item.stock_source === "legacy" ? "legacy" : "verified";
            await adjustStock(tenantId, branchId, item.product_id, -(item.qty_base ?? item.qty), "out", {
              stockSource: src,
              reference: savedTxNumber,
              userId: cashierId,
            });
          }

          // Update customer outstanding debt for credit sales
          if (paymentMethod === "credit" && cart.customer) {
            await updateCustomer(tenantId, cart.customer.id, {
              outstanding_debt: cart.customer.outstanding_debt + grandTotal,
            });
          }
        }

        recordSaleHistory(savedTxNumber, false);
        finalize(savedTxNumber, false);
        invalidateResponseCache(`branch-products:${tenantId}:${branchId}`);
        const hadSalesOrder = Boolean(checkoutExtras?.salesOrder);
        void invalidatePosAfterCheckout(tenantId, branchId, { hadSalesOrder });
        if (hadSalesOrder) {
          useNotificationStore.getState().addNotification({
            type: "info",
            title: "Sales Order baru",
            message: `SO dari checkout POS ${savedTxNumber} — siap diproses fulfillment`,
            branchId,
            entityId: null,
            entityType: "sales_order",
          });
        }
        return { success: true, transactionNumber: savedTxNumber, change: changeAmount };
      } catch (err) {
        set((s) => {
          s.isProcessing = false;
        });
        return { success: false, error: err instanceof Error ? err.message : "Pembayaran gagal" };
      }
    },

    adjustMockCustomerDebtDelta: (customerId, delta) =>
      set((s) => {
        s.mockCustomerDebtDelta[customerId] = (s.mockCustomerDebtDelta[customerId] ?? 0) + delta;
      }),

    clearReceipt: () =>
      set((s) => {
        s.lastReceipt = null;
      }),
  })),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectActiveSession = (s: PosState) => s.activeSession;
export const selectActiveCart = (s: PosState) => s.carts[s.activeCartIndex];
export const selectActiveCartIndex = (s: PosState) => s.activeCartIndex;
export const selectAllCarts = (s: PosState) => s.carts;
export const selectIsProcessing = (s: PosState) => s.isProcessing;
export const selectLastReceipt = (s: PosState) => s.lastReceipt;
export const selectSessionError = (s: PosState) => s.sessionError;

/** Derived: grand total of the active cart (after return offset) */
export const selectActiveCartTotal = (s: PosState): number => {
  const cart = s.carts[s.activeCartIndex];
  return cartNetTotal(cart);
};

/** Derived: subtotal of the active cart (before discount) */
export const selectActiveCartSubtotal = (s: PosState): number =>
  cartSubtotal(s.carts[s.activeCartIndex].items);

/** Derived: number of occupied cart slots */
export const selectOccupiedCartCount = (s: PosState): number =>
  s.carts.filter((c) => c.items.length > 0 || c.isHeld || c.returnOffset).length;

export { cartSubtotal, cartGrandTotal, cartNetTotal, cartReturnOffsetAmount };

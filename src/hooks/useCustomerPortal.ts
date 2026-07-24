// =============================================================================
// useCustomerPortal — katalog, keranjang, auth customer (portal order online).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { getMockPosCatalog, MOCK_CATEGORIES, MOCK_SKU_CATEGORY } from "@/lib/mock-pos-catalog";
import { MOCK_TENANT_ID, MOCK_BRANCH_SUDIRMAN, MOCK_BRANCH_KEBONJERUK, MOCK_BRANCH_BEKASI } from "@/lib/mock-ids";
import {
  canUseTempoPayment,
  portalStockStatus,
  PORTAL_STOCK_LABELS,
} from "@/lib/portal-utils";
import { useCustomerPortalStore, EMPTY_PORTAL_CART } from "@/stores/customer-portal.store";
import type { PortalCartItem, PortalPaymentMethod } from "@/types/customer-portal";
import type { Branch } from "@/types/database";

const PORTAL_DEMO_BRANCHES: Branch[] = [
  {
    id: MOCK_BRANCH_SUDIRMAN,
    tenant_id: MOCK_TENANT_ID,
    code: "SDR",
    name: "Cabang Sudirman",
    address: "Jl. Jend. Sudirman No. 45, Jakarta Pusat",
    phone: "021-5551234",
    manager_id: null,
    is_active: true,
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: MOCK_BRANCH_KEBONJERUK,
    tenant_id: MOCK_TENANT_ID,
    code: "KBJ",
    name: "Cabang Kebon Jeruk",
    address: "Jl. Kebon Jeruk Raya No. 12, Jakarta Barat",
    phone: "021-5555678",
    manager_id: null,
    is_active: true,
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: MOCK_BRANCH_BEKASI,
    tenant_id: MOCK_TENANT_ID,
    code: "BKS",
    name: "Cabang Bekasi",
    address: "Jl. Ahmad Yani No. 88, Bekasi",
    phone: "021-5559012",
    manager_id: null,
    is_active: true,
    created_at: "2024-01-01T00:00:00.000Z",
  },
];

export interface PortalCatalogItem {
  productId: string;
  branchProductId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  sellingPrice: number;
  stockLabel: keyof typeof PORTAL_STOCK_LABELS;
  stockLabelText: string;
}

export function useCustomerPortal(tenantId: string, tenantSlug: string) {
  const [mounted, setMounted] = useState(false);

  const seedIfEmpty = useCustomerPortalStore((s) => s.seedIfEmpty);
  const config = useCustomerPortalStore((s) => s.getConfig(tenantId));
  const persistedBranchId = useCustomerPortalStore((s) => s.branchByTenant[tenantId] ?? null);
  const persistedAccount = useCustomerPortalStore((s) => {
    const accountId = s.sessionByTenant[tenantId];
    if (!accountId) return null;
    return s.accounts.find((a) => a.id === accountId && a.tenantId === tenantId) ?? null;
  });
  const persistedCart = useCustomerPortalStore((s) => s.cartsByTenant[tenantId] ?? EMPTY_PORTAL_CART);
  const loginFn = useCustomerPortalStore((s) => s.login);
  const registerFn = useCustomerPortalStore((s) => s.register);
  const logoutFn = useCustomerPortalStore((s) => s.logout);
  const setBranchFn = useCustomerPortalStore((s) => s.setBranch);
  const addToCartFn = useCustomerPortalStore((s) => s.addToCart);
  const updateCartQtyFn = useCustomerPortalStore((s) => s.updateCartQty);
  const removeFromCartFn = useCustomerPortalStore((s) => s.removeFromCart);
  const submitOrderFn = useCustomerPortalStore((s) => s.submitOrder);
  const uploadProofFn = useCustomerPortalStore((s) => s.uploadPaymentProof);
  const listOrdersFn = useCustomerPortalStore((s) => s.listOrdersForAccount);

  const branchId = mounted ? persistedBranchId : null;
  const account = mounted ? persistedAccount : null;
  const cart = mounted ? persistedCart : EMPTY_PORTAL_CART;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    seedIfEmpty();
  }, [seedIfEmpty]);

  const branches = useMemo(
    () => PORTAL_DEMO_BRANCHES.filter((b) => b.tenant_id === tenantId && b.is_active),
    [tenantId],
  );

  const activeBranchId = branchId ?? branches[0]?.id ?? null;
  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? branches[0] ?? null;

  useEffect(() => {
    if (!mounted) return;
    if (activeBranchId && !branchId) {
      setBranchFn(tenantId, activeBranchId);
    }
  }, [mounted, activeBranchId, branchId, setBranchFn, tenantId]);

  const catalog = useMemo<PortalCatalogItem[]>(() => {
    if (!activeBranchId) return [];
    const raw = getMockPosCatalog(activeBranchId);
    return raw.map((bp) => {
      const label = portalStockStatus(bp.stock, bp.legacy_stock, bp.reorder_point);
      return {
        productId: bp.product_id,
        branchProductId: bp.id,
        sku: bp.product.sku,
        name: bp.product.name,
        category: MOCK_SKU_CATEGORY[bp.product.sku] ?? "Lainnya",
        unit: bp.product.unit,
        sellingPrice: bp.selling_price,
        stockLabel: label,
        stockLabelText: PORTAL_STOCK_LABELS[label],
      };
    });
  }, [activeBranchId]);

  const categories = useMemo(() => ["all", ...MOCK_CATEGORIES], []);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [catalog, search, category]);

  const cartTotal = useMemo(
    () => cart.reduce((s, i) => s + i.sellingPrice * i.qty, 0),
    [cart],
  );

  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const myOrders = useMemo(
    () => (account ? listOrdersFn(tenantId, account.id) : []),
    [account, listOrdersFn, tenantId],
  );

  const setBranch = useCallback(
    (id: string) => setBranchFn(tenantId, id),
    [setBranchFn, tenantId],
  );

  const addToCart = useCallback(
    (item: PortalCatalogItem, qty = 1) => {
      const cartItem: PortalCartItem = {
        productId: item.productId,
        branchProductId: item.branchProductId,
        productName: item.name,
        sku: item.sku,
        unit: item.unit,
        sellingPrice: item.sellingPrice,
        qty,
        stockLabel: item.stockLabel,
      };
      addToCartFn(tenantId, cartItem);
    },
    [addToCartFn, tenantId],
  );

  const updateCartQty = useCallback(
    (productId: string, qty: number) => updateCartQtyFn(tenantId, productId, qty),
    [updateCartQtyFn, tenantId],
  );

  const removeFromCart = useCallback(
    (productId: string) => removeFromCartFn(tenantId, productId),
    [removeFromCartFn, tenantId],
  );

  const login = useCallback(
    (email: string, password: string) => loginFn(tenantId, email, password),
    [loginFn, tenantId],
  );

  const register = useCallback(
    (name: string, email: string, phone: string, password: string) =>
      registerFn({ tenantId, name, email, phone, password }),
    [registerFn, tenantId],
  );

  const logout = useCallback(() => logoutFn(tenantId), [logoutFn, tenantId]);

  const submitOrder = useCallback(
    (deliveryAddress: string, notes: string, paymentMethod: PortalPaymentMethod) => {
      if (!account || !activeBranch) {
        return { ok: false as const, error: "Login dan pilih cabang terlebih dahulu" };
      }
      if (paymentMethod === "tempo" && !canUseTempoPayment(account)) {
        return { ok: false as const, error: "Akun belum member tempo" };
      }
      return submitOrderFn({
        tenantId,
        branchId: activeBranch.id,
        branchName: activeBranch.name,
        customerAccountId: account.id,
        customerName: account.name,
        customerPhone: account.phone,
        items: cart.map((c) => ({
          productId: c.productId,
          productName: c.productName,
          sku: c.sku,
          unit: c.unit,
          qty: c.qty,
          sellingPrice: c.sellingPrice,
          subtotal: c.sellingPrice * c.qty,
        })),
        deliveryAddress,
        notes,
        paymentMethod,
      });
    },
    [account, activeBranch, cart, submitOrderFn, tenantId],
  );

  const submitOrderWithNumber = useCallback(
    (deliveryAddress: string, notes: string, paymentMethod: PortalPaymentMethod) => {
      const r = submitOrder(deliveryAddress, notes, paymentMethod);
      if (r.ok && r.order) {
        return { ok: true as const, orderNumber: r.order.orderNumber };
      }
      return { ok: false as const, error: r.error };
    },
    [submitOrder],
  );

  const uploadPaymentProof = useCallback(
    (orderId: string, note: string) => uploadProofFn(orderId, note),
    [uploadProofFn],
  );

  return {
    tenantSlug,
    config,
    account,
    branches,
    activeBranch,
    catalog: filteredCatalog,
    categories,
    search,
    setSearch,
    category,
    setCategory,
    cart,
    cartTotal,
    cartCount,
    myOrders,
    canUseTempo: canUseTempoPayment(account),
    setBranch,
    addToCart,
    updateCartQty,
    removeFromCart,
    login,
    register,
    logout,
    submitOrder,
    submitOrderWithNumber,
    uploadPaymentProof,
  };
}

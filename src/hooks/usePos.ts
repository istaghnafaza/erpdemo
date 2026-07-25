// =============================================================================
// usePos — business logic for the POS module (Fase 7).
//
// Per Aturan 3 (Logic Separation): catalog/customer loading, cart math, stock
// status, and session/payment orchestration all live here. pos.tsx and the
// src/components/pos/* components only render what this hook returns.
//
// Demo mode (loginAsMock / MOCK_TENANT_ID): catalog + customers come from
// src/lib/mock-pos-catalog.ts (RLS blocks the real Supabase queries for mock
// sessions — same constraint documented across branch.store.ts,
// mock-notifications.ts, and pos.store.ts). Stock/debt deltas applied by
// completed sales are read back from pos.store's mockStockDelta /
// mockCustomerDebtDelta so the catalog reflects sales in real time without a
// backend. Real tenants use src/lib/api/{products,customers,transactions}.ts
// directly — no other code path changes once Fase 15 (real Auth) lands.
// =============================================================================

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { usePosStore, cartGrandTotal, cartSubtotal, type ActiveCart } from "@/stores/pos.store";
import { useCustomerDeliverySitesStore } from "@/stores/customer-delivery-sites.store";
import { listActiveSitesForCustomer } from "@/lib/customer-delivery-utils";
import { getCustomerSegment } from "@/stores/customers.store";
import { MANUAL_DELIVERY_SITE_VALUE } from "@/components/pos/SaveDeliverySiteDialog";
import type { DeliverySiteType } from "@/types/customer-delivery-sites";
import { useOfflineStore } from "@/stores/offline.store";
import { MOCK_TENANT_ID } from "@/stores/auth.store";
import { isNeonBackend } from "@/lib/api/backend";
import { isMockTenantId } from "@/lib/mock-session";
import { getBranchProducts } from "@/lib/api/products";
import { getCustomers } from "@/lib/api/customers";
import { getHeldCartsInBranch } from "@/lib/api/transactions";
import { useInventoryStore } from "@/stores/inventory.store";
import {
  getMockPosCatalog,
  MOCK_CATEGORIES,
  MOCK_SKU_CATEGORY,
} from "@/lib/mock-pos-catalog";
import { buildMockBranchCatalog } from "@/lib/mock-branch-catalog";
import { usePosHeldCartsStore } from "@/stores/pos-held-carts.store";
import { getMockTenantCustomers, useCustomersStore } from "@/stores/customers.store";
import { getProducts, getCustomers as getCachedCustomers } from "@/lib/offline/idb";
import type { BranchProductWithProduct, Customer, CartItem } from "@/types/database";
import type { PaymentMethod } from "@/types/app";

export type PosStockStatus = "normal" | "low" | "critical";

export interface PosCatalogItem {
  branchProductId: string;
  productId: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  reorderPoint: number;
  stockStatus: PosStockStatus;
  stockSource: "verified" | "legacy" | "unverified";
  canAddToCart: boolean;
}

export interface PosHeldCart {
  id: string;
  label: string;
  cashierName: string;
  customer: Customer | null;
  items: CartItem[];
  total: number;
  heldAt: string;
}

function stockStatusOf(stock: number, reorderPoint: number): PosStockStatus {
  if (stock <= 0) return "critical";
  if (stock <= reorderPoint) return "low";
  return "normal";
}

export function usePos() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isOnline = useOfflineStore((s) => s.isOnline);

  const user = currentUser?.profile ?? null;
  const tenantId = currentUser?.tenantId ?? "";
  const branchId = activeBranch?.id ?? "";
  const isMockTenant = isMockTenantId(tenantId);

  // -------------------------------------------------------------------------
  // Store wiring
  // -------------------------------------------------------------------------
  const initContext = usePosStore((s) => s.initContext);
  const activeSession = usePosStore((s) => s.activeSession);
  const sessionLoading = usePosStore((s) => s.sessionLoading);
  const sessionError = usePosStore((s) => s.sessionError);
  const openSessionFn = usePosStore((s) => s.openSession);
  const closeSessionFn = usePosStore((s) => s.closeSession);
  const carts = usePosStore((s) => s.carts);
  const activeCartIndex = usePosStore((s) => s.activeCartIndex);
  const isProcessing = usePosStore((s) => s.isProcessing);
  const lastReceipt = usePosStore((s) => s.lastReceipt);
  const mockStockDelta = usePosStore((s) => s.mockStockDelta);
  const mockStockAdjustments = useInventoryStore((s) => s.mockStockAdjustments);
  const mockProductOverrides = useInventoryStore((s) => s.mockProductOverrides);
  const mockDeactivatedIds = useInventoryStore((s) => s.mockDeactivatedIds);
  const currentTenant = useAuthStore((s) => s.currentTenant);
  const legacyModeActive = currentTenant?.legacy_mode_active ?? false;

  const addCartFn = usePosStore((s) => s.addCart);
  const removeCartFn = usePosStore((s) => s.removeCart);
  const switchCartFn = usePosStore((s) => s.switchCart);
  const holdCartFn = usePosStore((s) => s.holdCart);
  const resumeCartFn = usePosStore((s) => s.resumeCart);
  const clearCartFn = usePosStore((s) => s.clearCart);
  const takeoverCartFn = usePosStore((s) => s.takeoverCart);
  const addItemToCartFn = usePosStore((s) => s.addItemToCart);
  const updateItemQtyFn = usePosStore((s) => s.updateItemQty);
  const removeItemFn = usePosStore((s) => s.removeItem);
  const setDiscountFn = usePosStore((s) => s.setDiscount);
  const setCustomerFn = usePosStore((s) => s.setCustomer);
  const setNotesFn = usePosStore((s) => s.setNotes);
  const setOrderFulfillmentTypeFn = usePosStore((s) => s.setOrderFulfillmentType);
  const setPartialShipLineFn = usePosStore((s) => s.setPartialShipLine);
  const toggleItemSoLineFn = usePosStore((s) => s.toggleItemSoLine);
  const setDeliverySiteFn = usePosStore((s) => s.setDeliverySite);
  const setManualDeliveryAddressFn = usePosStore((s) => s.setManualDeliveryAddress);
  const processPaymentFn = usePosStore((s) => s.processPayment);
  const clearReceiptFn = usePosStore((s) => s.clearReceipt);
  const seedDeliverySites = useCustomerDeliverySitesStore((s) => s.seedIfEmpty);
  const deliverySitesAll = useCustomerDeliverySitesStore((s) => s.sites);
  const getLastUsedSiteId = useCustomerDeliverySitesStore((s) => s.getLastUsedSiteId);
  const addDeliverySite = useCustomerDeliverySitesStore((s) => s.addSite);

  // -------------------------------------------------------------------------
  // Init POS context whenever cashier/branch changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!user || !activeBranch || !tenantId) return;
    initContext({
      tenantId,
      branchId: activeBranch.id,
      branchName: activeBranch.name,
      branchAddress: activeBranch.address,
      cashierId: user.id,
      cashierName: user.name,
      branchCode: activeBranch.code,
    });
    // Depend on ids only, not full user/activeBranch objects, to avoid re-init on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeBranch?.id, tenantId, initContext]);

  useEffect(() => {
    seedDeliverySites();
  }, [seedDeliverySites]);

  // -------------------------------------------------------------------------
  // Catalog (products + branch stock/price)
  // -------------------------------------------------------------------------
  const [rawCatalog, setRawCatalog] = useState<BranchProductWithProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !branchId) return;
    let cancelled = false;
    setCatalogLoading(true);

    if (isMockTenant) {
      Promise.resolve().then(() => {
        if (cancelled) return;
        setRawCatalog(getMockPosCatalog(branchId));
        setCatalogLoading(false);
      });
    } else if (!isOnline) {
      void getProducts<BranchProductWithProduct>(tenantId, branchId).then((cached) => {
        if (cancelled) return;
        setRawCatalog(cached);
        setCatalogLoading(false);
      });
    } else {
      void getBranchProducts(tenantId, branchId).then((result) => {
        if (cancelled) return;
        setRawCatalog(result.data ?? []);
        setCatalogLoading(false);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [tenantId, branchId, isMockTenant, isOnline]);

  const catalog = useMemo<PosCatalogItem[]>(() => {
    if (isMockTenant) {
      return buildMockBranchCatalog({
        branchId,
        legacyModeActive,
        stockDelta: mockStockDelta,
        stockAdjustments: mockStockAdjustments,
        overrides: mockProductOverrides,
        deactivated: mockDeactivatedIds,
      }).map((line) => ({
        branchProductId: line.branchProductId,
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        unit: line.unit,
        category: line.category,
        sellingPrice: line.sellingPrice,
        purchasePrice: line.purchasePrice,
        stock: line.stock,
        reorderPoint: line.reorderPoint,
        stockStatus: stockStatusOf(line.stock, line.reorderPoint),
        stockSource: line.stockSource,
        canAddToCart: line.canAddToCart,
      }));
    }

    return rawCatalog.map((bp) => {
      const delta = mockStockDelta[bp.product_id] ?? 0;
      const stock = Math.max(0, bp.stock + delta);
      return {
        branchProductId: bp.id,
        productId: bp.product_id,
        sku: bp.product.sku,
        name: bp.product.name,
        unit: bp.product.unit,
        category: bp.product.category_id
          ? ((bp.product as unknown as { category?: { name: string } }).category?.name ?? "Lainnya")
          : (MOCK_SKU_CATEGORY[bp.product.sku] ?? "Lainnya"),
        sellingPrice: bp.selling_price,
        purchasePrice: bp.product.purchase_price,
        stock,
        reorderPoint: bp.reorder_point,
        stockStatus: stockStatusOf(stock, bp.reorder_point),
        stockSource: "verified" as const,
        canAddToCart: stock > 0,
      };
    });
  }, [
    isMockTenant,
    branchId,
    legacyModeActive,
    mockStockDelta,
    mockStockAdjustments,
    mockProductOverrides,
    mockDeactivatedIds,
    rawCatalog,
  ]);

  const categories = useMemo<string[]>(() => {
    if (isMockTenant) return MOCK_CATEGORIES;
    return Array.from(new Set(catalog.map((c) => c.category))).sort();
  }, [catalog, isMockTenant]);

  // -------------------------------------------------------------------------
  // Customers
  // -------------------------------------------------------------------------
  const [customers, setCustomers] = useState<Customer[]>([]);
  const mockStoreCustomers = useCustomersStore((s) => s.customers);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    if (isMockTenant) {
      setCustomers(getMockTenantCustomers(tenantId));
    } else if (!isOnline && branchId) {
      void getCachedCustomers<Customer>(tenantId, branchId).then((cached) => {
        if (!cancelled) setCustomers(cached);
      });
    } else {
      void getCustomers(tenantId).then((result) => {
        if (!cancelled) setCustomers(result.data ?? []);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [tenantId, branchId, isMockTenant, isOnline, mockStoreCustomers]);

  const customerDebtDelta = usePosStore((s) => s.mockCustomerDebtDelta);
  const customersWithLiveDebt = useMemo(
    () =>
      customers.map((c) => ({
        ...c,
        outstanding_debt: c.outstanding_debt + (customerDebtDelta[c.id] ?? 0),
      })),
    [customers, customerDebtDelta],
  );

  // -------------------------------------------------------------------------
  // Held carts from other cashiers (for TakeoverModal)
  // -------------------------------------------------------------------------
  const [heldCarts, setHeldCarts] = useState<PosHeldCart[]>([]);

  const refreshHeldCarts = useCallback(async () => {
    if (!tenantId || !branchId || !user) return;

    if (isMockTenant) {
      const branchHeld = usePosHeldCartsStore
        .getState()
        .listForBranch(tenantId, branchId, user.id);
      setHeldCarts(
        branchHeld.map((c) => ({
          id: c.id,
          label: c.label,
          cashierName: c.cashierName,
          customer: c.customer,
          items: c.items,
          total: cartGrandTotal(c.items, c.discount),
          heldAt: c.heldAt,
        })),
      );
      return;
    }

    const result = await getHeldCartsInBranch(tenantId, branchId, user.id);
    const rows = result.data ?? [];
    setHeldCarts(
      rows.map((r) => ({
        id: r.id,
        label: `Keranjang #${r.cart_number} — ${r.cashier?.name ?? "Kasir lain"}`,
        cashierName: r.cashier?.name ?? "Kasir lain",
        customer: r.customer_id ? (customers.find((c) => c.id === r.customer_id) ?? null) : null,
        items: [], // line items aren't persisted server-side — see getHeldCartsInBranch() doc comment
        total: 0,
        heldAt: r.updated_at,
      })),
    );
  }, [tenantId, branchId, user, isMockTenant, customers]);

  useEffect(() => {
    void refreshHeldCarts();
  }, [refreshHeldCarts]);

  // -------------------------------------------------------------------------
  // Active cart derived values
  // -------------------------------------------------------------------------
  const activeCart: ActiveCart = carts[activeCartIndex];
  const activeCartSubtotal = cartSubtotal(activeCart.items);
  const activeCartTotal = cartGrandTotal(activeCart.items, activeCart.discount);
  const activeCartDiscountAmount = activeCartSubtotal - activeCartTotal;

  const activeDeliverySites = useMemo(
    () =>
      activeCart.customer
        ? listActiveSitesForCustomer(activeCart.customer.id, deliverySitesAll)
        : [],
    [activeCart.customer, deliverySitesAll],
  );

  const customerSegment = activeCart.customer
    ? getCustomerSegment(activeCart.customer.id)
    : null;

  const lastUsedSiteId = activeCart.customer
    ? getLastUsedSiteId(activeCart.customer.id)
    : null;

  const occupiedCartCount = useMemo(
    () => carts.filter((c) => c.items.length > 0 || c.isHeld).length,
    [carts],
  );

  // -------------------------------------------------------------------------
  // Cart item helpers
  // -------------------------------------------------------------------------
  const addProductToCart = useCallback(
    (item: PosCatalogItem, qty = 1) => {
      const availableStock =
        item.stock > 0 ? item.stock : legacyModeActive ? 9999 : 0;
      const cartItem: CartItem = {
        product_id: item.productId,
        branch_product_id: item.branchProductId,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        qty,
        selling_price: item.sellingPrice,
        purchase_price: item.purchasePrice,
        discount: 0,
        subtotal: item.sellingPrice * qty,
        stock_source: item.stockSource,
        available_stock: availableStock,
        is_so_line: false,
      };
      addItemToCartFn(activeCartIndex, cartItem);
    },
    [activeCartIndex, addItemToCartFn, legacyModeActive],
  );

  const updateActiveItemQty = useCallback(
    (itemIndex: number, qty: number) => updateItemQtyFn(activeCartIndex, itemIndex, qty),
    [activeCartIndex, updateItemQtyFn],
  );

  const removeActiveItem = useCallback(
    (itemIndex: number) => removeItemFn(activeCartIndex, itemIndex),
    [activeCartIndex, removeItemFn],
  );

  const setActiveDiscount = useCallback(
    (percent: number) => setDiscountFn(activeCartIndex, percent),
    [activeCartIndex, setDiscountFn],
  );

  const setActiveCustomer = useCallback(
    (customer: Customer | null) => setCustomerFn(activeCartIndex, customer),
    [activeCartIndex, setCustomerFn],
  );

  const setActiveNotes = useCallback(
    (notes: string) => setNotesFn(activeCartIndex, notes),
    [activeCartIndex, setNotesFn],
  );

  const setActiveOrderFulfillmentType = useCallback(
    (type: Parameters<typeof setOrderFulfillmentTypeFn>[1]) =>
      setOrderFulfillmentTypeFn(activeCartIndex, type),
    [activeCartIndex, setOrderFulfillmentTypeFn],
  );

  const setActivePartialShipLine = useCallback(
    (itemIndex: number, patch: { selected?: boolean; shipQty?: number }) =>
      setPartialShipLineFn(activeCartIndex, itemIndex, patch),
    [activeCartIndex, setPartialShipLineFn],
  );

  const toggleActiveItemSoLine = useCallback(
    (itemIndex: number) => toggleItemSoLineFn(activeCartIndex, itemIndex),
    [activeCartIndex, toggleItemSoLineFn],
  );

  const setActiveDeliverySite = useCallback(
    (siteId: string) => {
      if (siteId === MANUAL_DELIVERY_SITE_VALUE) {
        setManualDeliveryAddressFn(
          activeCartIndex,
          activeCart.deliveryAddress ?? activeCart.customer?.address ?? "",
        );
        return;
      }
      setDeliverySiteFn(activeCartIndex, siteId);
    },
    [
      activeCartIndex,
      activeCart.deliveryAddress,
      activeCart.customer?.address,
      setDeliverySiteFn,
      setManualDeliveryAddressFn,
    ],
  );

  const setActiveManualDeliveryAddress = useCallback(
    (address: string) => setManualDeliveryAddressFn(activeCartIndex, address),
    [activeCartIndex, setManualDeliveryAddressFn],
  );

  const saveNewDeliverySiteFromPos = useCallback(
    (payload: { label: string; address: string; siteType: DeliverySiteType }) => {
      if (!activeCart.customer || !tenantId) return;
      const site = addDeliverySite({
        tenantId,
        customerId: activeCart.customer.id,
        label: payload.label,
        address: payload.address,
        siteType: payload.siteType,
      });
      setDeliverySiteFn(activeCartIndex, site.id);
    },
    [activeCart.customer, activeCartIndex, tenantId, addDeliverySite, setDeliverySiteFn],
  );

  const holdActiveCart = useCallback(() => {
    holdCartFn(activeCartIndex);
    void refreshHeldCarts();
  }, [activeCartIndex, holdCartFn, refreshHeldCarts]);

  const resumeActiveCart = useCallback(
    (index: number) => {
      resumeCartFn(index);
      void refreshHeldCarts();
    },
    [resumeCartFn, refreshHeldCarts],
  );
  const clearActiveCart = useCallback(
    () => clearCartFn(activeCartIndex),
    [activeCartIndex, clearCartFn],
  );

  const takeover = useCallback(
    (heldCart: PosHeldCart) => {
      const ok = takeoverCartFn(heldCart.id, heldCart.items, heldCart.customer, heldCart.label);
      if (ok) {
        setHeldCarts((prev) => prev.filter((c) => c.id !== heldCart.id));
        void refreshHeldCarts();
      }
      return ok;
    },
    [takeoverCartFn, refreshHeldCarts],
  );

  const pay = useCallback(
    (paymentMethod: PaymentMethod, amountPaid: number) =>
      processPaymentFn(activeCartIndex, paymentMethod, amountPaid),
    [activeCartIndex, processPaymentFn],
  );

  return {
    // Context
    user,
    isOnline,
    isMockTenant,
    legacyModeActive,
    branch: activeBranch,

    // Session
    activeSession,
    sessionLoading,
    sessionError,
    openSession: openSessionFn,
    closeSession: closeSessionFn,

    // Catalog
    catalog,
    catalogLoading,
    categories,

    // Customers
    customers: customersWithLiveDebt,

    // Carts
    carts,
    activeCartIndex,
    activeCart,
    activeCartSubtotal,
    activeCartTotal,
    activeCartDiscountAmount,
    occupiedCartCount,
    addCart: addCartFn,
    removeCart: removeCartFn,
    switchCart: switchCartFn,
    holdActiveCart,
    resumeCart: resumeActiveCart,
    clearActiveCart,

    // Held carts / takeover
    heldCarts,
    refreshHeldCarts,
    takeover,

    // Items
    addProductToCart,
    updateActiveItemQty,
    removeActiveItem,
    setActiveDiscount,
    setActiveCustomer,
    setActiveNotes,
    activeDeliverySites,
    customerSegment,
    lastUsedSiteId,
    isManualDeliveryAddress: activeCart.isManualDeliveryAddress,
    setActiveDeliverySite,
    setActiveManualDeliveryAddress,
    saveNewDeliverySiteFromPos,
    activeOrderFulfillmentType: activeCart.orderFulfillmentType,
    setActiveOrderFulfillmentType,
    activePartialShip: activeCart.partialShip,
    setActivePartialShipLine,
    toggleActiveItemSoLine,

    // Payment
    isProcessing,
    lastReceipt,
    pay,
    clearReceipt: clearReceiptFn,
  };
}

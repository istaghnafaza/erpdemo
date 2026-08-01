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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { usePosStore, cartGrandTotal, cartSubtotal, type ActiveCart } from "@/stores/pos.store";
import { useCustomerDeliverySitesStore } from "@/stores/customer-delivery-sites.store";
import { listActiveSitesForCustomer } from "@/lib/customer-delivery-utils";
import { getCustomerSegment, getMockTenantCustomers, useCustomersStore } from "@/stores/customers.store";
import { MANUAL_DELIVERY_SITE_VALUE } from "@/components/pos/SaveDeliverySiteDialog";
import type { CustomerFormValues } from "@/components/customers/CustomerFormDialog";
import type { DeliverySiteType } from "@/types/customer-delivery-sites";
import { useOfflineStore } from "@/stores/offline.store";
import { isMockTenantId } from "@/lib/mock-session";
import { createCustomer, getCustomers } from "@/lib/api/customers";
import { invalidatePosCustomers } from "@/lib/invalidate-pos-queries";
import { getHeldCartsInBranch } from "@/lib/api/transactions";
import { queryKeys } from "@/lib/query-keys";
import { useInventoryStore } from "@/stores/inventory.store";
import {
  getMockPosCatalog,
  MOCK_CATEGORIES,
  MOCK_SKU_CATEGORY,
} from "@/lib/mock-pos-catalog";
import { buildMockBranchCatalog } from "@/lib/mock-branch-catalog";
import { usePosHeldCartsStore } from "@/stores/pos-held-carts.store";
import { getProducts, getCustomers as getCachedCustomers } from "@/lib/offline/idb";
import { fetchPosCatalogWithWarm } from "@/lib/offline/pos-catalog-warm";
import { getPricingBundle } from "@/lib/api/pricing";
import { applyPricingToCartItem } from "@/lib/apply-cart-pricing";
import type { PricingBundle } from "@/types/pricing";
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
  categoryId: string | null;
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
  const queryClient = useQueryClient();

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
  const repriceCartFn = usePosStore((s) => s.repriceCart);
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
      branchPhone: activeBranch.phone,
      storeName: currentTenant?.name ?? activeBranch.name,
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

  const catalogQuery = useQuery({
    queryKey: [...queryKeys.posCatalog(tenantId, branchId), isOnline],
    queryFn: async (): Promise<BranchProductWithProduct[]> => {
      if (isMockTenant) return getMockPosCatalog(branchId);
      if (!isOnline) return getProducts<BranchProductWithProduct>(tenantId, branchId);
      const cacheKey = queryKeys.posCatalog(tenantId, branchId);
      return fetchPosCatalogWithWarm(tenantId, branchId, (fresh) => {
        queryClient.setQueryData([...cacheKey, isOnline], fresh);
      });
    },
    enabled: Boolean(tenantId && branchId),
    staleTime: 60_000,
  });

  const pricingQuery = useQuery({
    queryKey: queryKeys.pricingBundle(tenantId),
    queryFn: async (): Promise<PricingBundle> => {
      const result = await getPricingBundle(tenantId);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });

  const pricingBundle = pricingQuery.data ?? null;

  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [customerSaving, setCustomerSaving] = useState(false);
  const addCustomerLocal = useCustomersStore((s) => s.addCustomer);
  const rememberSegment = useCustomersStore((s) => s.rememberSegment);

  const customerTierOptions = useMemo(
    () =>
      (pricingBundle?.customer_tiers ?? [])
        .filter((t) => t.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((t) => ({
          id: t.id,
          label: `${t.tier_code} — ${t.name} (${t.discount_percent}%)`,
        })),
    [pricingBundle],
  );

  const rawCatalog = catalogQuery.data ?? [];
  const catalogLoading = catalogQuery.isPending;

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
        categoryId: null,
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
        categoryId: bp.product.category_id ?? null,
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
  const mockStoreCustomers = useCustomersStore((s) => s.customers);

  const customersQuery = useQuery({
    queryKey: [...queryKeys.posCustomers(tenantId), branchId, isOnline, mockStoreCustomers.length],
    queryFn: async (): Promise<Customer[]> => {
      if (isMockTenant) return getMockTenantCustomers(tenantId);
      if (!isOnline && branchId) {
        return getCachedCustomers<Customer>(tenantId, branchId);
      }
      const result = await getCustomers(tenantId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: Boolean(tenantId),
  });

  const customers = customersQuery.data ?? [];

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
      let cartItem: CartItem = {
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
        base_selling_price: item.sellingPrice,
        category_id: item.categoryId,
      };
      if (pricingBundle) {
        cartItem = applyPricingToCartItem(cartItem, activeCart.customer, pricingBundle);
      }
      addItemToCartFn(activeCartIndex, cartItem);
    },
    [
      activeCartIndex,
      activeCart.customer,
      addItemToCartFn,
      legacyModeActive,
      pricingBundle,
    ],
  );

  useEffect(() => {
    if (!pricingBundle) return;
    repriceCartFn(activeCartIndex, pricingBundle);
  }, [
    activeCart.customer?.id,
    activeCart.customer?.pricing_tier_id,
    pricingBundle,
    activeCartIndex,
    repriceCartFn,
  ]);

  const updateActiveItemQty = useCallback(
    (itemIndex: number, qty: number) => {
      updateItemQtyFn(activeCartIndex, itemIndex, qty);
      if (pricingBundle) {
        repriceCartFn(activeCartIndex, pricingBundle);
      }
    },
    [activeCartIndex, updateItemQtyFn, pricingBundle, repriceCartFn],
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
    (itemIndex: number) => {
      toggleItemSoLineFn(activeCartIndex, itemIndex);
      if (pricingBundle) repriceCartFn(activeCartIndex, pricingBundle);
    },
    [activeCartIndex, toggleItemSoLineFn, pricingBundle, repriceCartFn],
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

  const openAddCustomer = useCallback(() => {
    setCustomerFormOpen(true);
  }, []);

  const handleCustomerFormSubmit = useCallback(
    async (values: CustomerFormValues) => {
      if (!tenantId) return;

      if (isMockTenant) {
        const result = addCustomerLocal(tenantId, values);
        if (result.ok && result.customer) {
          rememberSegment(result.customer.id, values.segment);
          setActiveCustomer(result.customer);
          setCustomerFormOpen(false);
          toast.success("Pelanggan ditambahkan");
        } else if (result.error) {
          toast.error(result.error);
        }
        return;
      }

      setCustomerSaving(true);
      try {
        const result = await createCustomer(tenantId, {
          name: values.name,
          phone: values.phone ?? null,
          address: values.address ?? null,
          type: values.type,
          credit_limit: values.type === "credit" ? (values.credit_limit ?? 0) : 0,
          outstanding_debt: 0,
          pricing_tier_id: values.pricing_tier_id,
        });
        if (result.error || !result.data) {
          toast.error(result.error ?? "Gagal menambah pelanggan");
          return;
        }
        rememberSegment(result.data.id, values.segment ?? "umum");
        await invalidatePosCustomers(tenantId);
        await queryClient.invalidateQueries({ queryKey: queryKeys.posCustomers(tenantId) });
        setActiveCustomer(result.data);
        setCustomerFormOpen(false);
        toast.success("Pelanggan ditambahkan — sudah tersedia di keranjang");
      } finally {
        setCustomerSaving(false);
      }
    },
    [
      tenantId,
      isMockTenant,
      addCustomerLocal,
      rememberSegment,
      setActiveCustomer,
      queryClient,
    ],
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
    pricingBundle,

    // Customers
    customers: customersWithLiveDebt,
    customerFormOpen,
    setCustomerFormOpen,
    customerSaving,
    customerTierOptions,
    openAddCustomer,
    handleCustomerFormSubmit,

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

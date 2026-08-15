// =============================================================================
// TanStack Query keys — keep stable across hooks and invalidations.
// =============================================================================

export const queryKeys = {
  dashboardBundle: (tenantId: string, branchIds: readonly string[]) =>
    ["dashboard-bundle", tenantId, [...branchIds].sort().join(",")] as const,
  posCatalog: (tenantId: string, branchId: string) =>
    ["pos-catalog", tenantId, branchId] as const,
  posCustomers: (tenantId: string) => ["pos-customers", tenantId] as const,
  inventoryCatalog: (tenantId: string, branchIds: readonly string[]) =>
    ["inventory-catalog", tenantId, [...branchIds].sort().join(",")] as const,
  categories: (tenantId: string) => ["categories", tenantId] as const,
  reportsBundle: (
    tenantId: string,
    branchIds: readonly string[],
    period: string,
    monthRange: { from: string; to: string },
  ) =>
    [
      "reports-bundle",
      tenantId,
      [...branchIds].sort().join(","),
      period,
      monthRange.from,
      monthRange.to,
    ] as const,
  moduleNavCounts: (tenantId: string, branchId: string) =>
    ["module-nav-counts", tenantId, branchId] as const,
  pricingBundle: (tenantId: string) => ["pricing-bundle", tenantId] as const,
  financeOverview: (tenantId: string, branchIds: readonly string[]) =>
    ["finance-overview", tenantId, [...branchIds].sort().join(",")] as const,
  cashflowVsAccrual: (tenantId: string, branchIds: readonly string[]) =>
    ["cashflow-vs-accrual", tenantId, [...branchIds].sort().join(",")] as const,
  cashForecast: (tenantId: string, branchIds: readonly string[]) =>
    ["cash-forecast", tenantId, [...branchIds].sort().join(",")] as const,
  cashLock: (tenantId: string, branchIds: readonly string[], categoryId = "") =>
    ["cash-lock", tenantId, [...branchIds].sort().join(","), categoryId] as const,
  cashflowKpis: (tenantId: string, branchIds: readonly string[]) =>
    ["cashflow-kpis", tenantId, [...branchIds].sort().join(",")] as const,
  ownerCapital: (tenantId: string, branchIds: readonly string[]) =>
    ["owner-capital", tenantId, [...branchIds].sort().join(",")] as const,
  cashBookOverview: (
    tenantId: string,
    branchIds: readonly string[],
    dateFrom: string,
    dateTo: string,
  ) =>
    [
      "cash-book-overview",
      tenantId,
      [...branchIds].sort().join(","),
      dateFrom,
      dateTo,
    ] as const,
  salesOrders: (tenantId: string, branchId: string, status: string) =>
    ["sales-orders", tenantId, branchId, status] as const,
  purchaseOrders: (tenantId: string, branchId: string) =>
    ["purchase-orders", tenantId, branchId] as const,
  suppliers: (tenantId: string, activeOnly: boolean) =>
    ["suppliers", tenantId, activeOnly] as const,
  suppliersWithProducts: (tenantId: string) =>
    ["suppliers-with-products", tenantId] as const,
  products: (tenantId: string) => ["products", tenantId] as const,
  branchPaymentSettings: (tenantId: string, branchId: string) =>
    ["branch-payment-settings", tenantId, branchId] as const,
};

// =============================================================================
// Prefetch module queries on sidebar hover (Sprint 3 P1-3, extended Fase B)
// =============================================================================

import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { getBranchProducts, getBranchProductsMulti, getCategories } from "@/lib/api/products";
import { getCustomers } from "@/lib/api/customers";
import { fetchFinanceOverview } from "@/lib/finance-overview-client";
import { getSalesOrders } from "@/lib/api/sales-orders";
import { getPurchaseOrders, getSuppliers } from "@/lib/api/purchasing";
import { isMockTenantId } from "@/lib/mock-session";

export function prefetchPosModule(tenantId: string, branchId: string) {
  if (!tenantId || !branchId || isMockTenantId(tenantId)) return;

  const qc = getQueryClient();
  void qc.prefetchQuery({
    queryKey: [...queryKeys.posCatalog(tenantId, branchId), true],
    queryFn: async () => {
      const result = await getBranchProducts(tenantId, branchId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    staleTime: 120_000,
  });
  void qc.prefetchQuery({
    queryKey: [...queryKeys.posCustomers(tenantId), branchId, true, 0],
    queryFn: async () => {
      const result = await getCustomers(tenantId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    staleTime: 120_000,
  });
}

export function prefetchInventoryModule(tenantId: string, branchIds: readonly string[]) {
  if (!tenantId || branchIds.length === 0 || isMockTenantId(tenantId)) return;

  const qc = getQueryClient();
  void qc.prefetchQuery({
    queryKey: queryKeys.inventoryCatalog(tenantId, branchIds),
    queryFn: async () => {
      const [catResult, bpResult] = await Promise.all([
        getCategories(tenantId),
        getBranchProductsMulti(tenantId, [...branchIds]),
      ]);
      if (catResult.error) throw new Error(catResult.error);
      if (bpResult.error) throw new Error(bpResult.error);
      return {
        categories: catResult.data ?? [],
        byBranch: bpResult.data ?? {},
      };
    },
    staleTime: 120_000,
  });
}

export function prefetchFinanceModule(tenantId: string, branchIds: readonly string[]) {
  if (!tenantId || branchIds.length === 0 || isMockTenantId(tenantId)) return;

  const qc = getQueryClient();
  void qc.prefetchQuery({
    queryKey: queryKeys.financeOverview(tenantId, branchIds),
    queryFn: () => fetchFinanceOverview(tenantId, branchIds),
    staleTime: 120_000,
  });
}

export function prefetchSalesOrdersModule(tenantId: string, branchId: string) {
  if (!tenantId || !branchId || isMockTenantId(tenantId)) return;

  const qc = getQueryClient();
  void qc.prefetchQuery({
    queryKey: queryKeys.salesOrders(tenantId, branchId, "all"),
    queryFn: async () => {
      const result = await getSalesOrders(tenantId, branchId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    staleTime: 60_000,
  });
  void qc.prefetchQuery({
    queryKey: queryKeys.suppliers(tenantId, true),
    queryFn: async () => {
      const result = await getSuppliers(tenantId, { activeOnly: true });
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    staleTime: 120_000,
  });
}

export function prefetchPurchaseOrdersModule(tenantId: string, branchId: string) {
  if (!tenantId || !branchId || isMockTenantId(tenantId)) return;

  const qc = getQueryClient();
  void qc.prefetchQuery({
    queryKey: queryKeys.purchaseOrders(tenantId, branchId),
    queryFn: async () => {
      const result = await getPurchaseOrders(tenantId, branchId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    staleTime: 60_000,
  });
}

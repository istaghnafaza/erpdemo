// =============================================================================
// Invalidate TanStack Query caches after POS checkout / master-data changes
// =============================================================================

import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

export async function invalidatePosAfterCheckout(
  tenantId: string,
  branchId: string,
  options?: { hadSalesOrder?: boolean },
): Promise<void> {
  try {
    const qc = getQueryClient();
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.posCatalog(tenantId, branchId) }),
      qc.invalidateQueries({ queryKey: ["inventory-catalog", tenantId] }),
      qc.invalidateQueries({ queryKey: queryKeys.posCustomers(tenantId) }),
      qc.invalidateQueries({ queryKey: ["deliveries", tenantId] }),
      qc.invalidateQueries({ queryKey: queryKeys.salesOrders(tenantId, branchId) }),
      qc.invalidateQueries({ queryKey: queryKeys.moduleNavCounts(tenantId, branchId) }),
      qc.invalidateQueries({ queryKey: ["finance", tenantId, branchId] }),
      qc.invalidateQueries({ queryKey: ["finance-overview", tenantId] }),
      qc.invalidateQueries({ queryKey: ["cashflow-vs-accrual"] }),
      qc.invalidateQueries({ queryKey: ["cashflow-kpis"] }),
    ]);
    if (options?.hadSalesOrder) {
      await qc.refetchQueries({ queryKey: queryKeys.moduleNavCounts(tenantId, branchId) });
    }
  } catch {
    // query client only in browser
  }
}

export async function invalidateAfterGoodsReceipt(
  tenantId: string,
  branchId: string,
): Promise<void> {
  try {
    const qc = getQueryClient();
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["pos-catalog", tenantId] }),
      qc.invalidateQueries({ queryKey: ["inventory-catalog", tenantId] }),
      qc.invalidateQueries({ queryKey: queryKeys.products(tenantId) }),
      qc.invalidateQueries({ queryKey: queryKeys.purchaseOrders(tenantId, branchId) }),
      qc.invalidateQueries({ queryKey: ["payables", tenantId] }),
      qc.invalidateQueries({ queryKey: queryKeys.suppliers(tenantId, true) }),
      qc.invalidateQueries({ queryKey: queryKeys.suppliers(tenantId, false) }),
    ]);
    await Promise.all([
      qc.refetchQueries({ queryKey: ["pos-catalog", tenantId] }),
      qc.refetchQueries({ queryKey: ["inventory-catalog", tenantId] }),
    ]);
  } catch {
    // query client only in browser
  }
}

export async function invalidatePosCustomers(tenantId: string): Promise<void> {
  try {
    const qc = getQueryClient();
    await qc.invalidateQueries({ queryKey: queryKeys.posCustomers(tenantId) });
  } catch {
    // ignore
  }
}

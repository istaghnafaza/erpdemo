// =============================================================================
// Sales Transactions API — histori penjualan (Neon + mock store)
// =============================================================================

import { isNeonBackend, isMockBackend, neonCall } from "@/lib/api/backend";
import { neonListSalesHistory } from "@/lib/api/neon/transaction-fns";
import { mapSalesHistoryToRecord } from "@/lib/map-sales-transaction";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import { useSalesTransactionsStore } from "@/stores/sales-transactions.store";
import type { SalesTransactionRecord } from "@/types/sales-transactions";
import type { ApiResponse } from "@/types/app";
import { fail, ok } from "./client";

export async function listSalesTransactions(
  tenantId: string,
  branchIds?: string[],
): Promise<ApiResponse<SalesTransactionRecord[]>> {
  const useMockStore =
    isMockBackend() || (isMockTenantId(tenantId));

  if (useMockStore) {
    try {
      useSalesTransactionsStore.getState().seedIfEmpty();
      let rows = useSalesTransactionsStore.getState().listForTenant(tenantId);
      if (branchIds && branchIds.length > 0) {
        const allowed = new Set(branchIds);
        rows = rows.filter((t) => allowed.has(t.branchId));
      }
      return ok(rows);
    } catch (err) {
      return fail(err);
    }
  }

  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonListSalesHistory({
        data: { tenantId, branchIds: branchIds ?? [], limit: 300 },
      }),
    );
    if (result.error) return fail(result.error);
    const rows = (result.data ?? []).map(mapSalesHistoryToRecord);
    return ok(rows);
  }

  return fail("Backend tidak aktif. Set VITE_DATA_BACKEND=neon");
}

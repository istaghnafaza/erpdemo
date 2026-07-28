// =============================================================================
// Finance overview bundle — 1 server fn for dashboard keuangan (Fase B P1)
// =============================================================================

import { listCashAccounts, listCashTransactions } from "@/server/services/finance";
import { getArSummary } from "@/server/services/receivables";
import type { DateRangeFilter } from "@/types/app";
import type { CashAccount, CashTransaction } from "@/types/database";

export interface FinanceOverviewBranchSlice {
  branchId: string;
  accounts: CashAccount[];
  transactions: CashTransaction[];
  arSummary: { total: number; overdue: number; unpaid: number; partial: number };
}

export interface FinanceOverviewReport {
  branches: FinanceOverviewBranchSlice[];
}

export async function getFinanceOverviewReport(
  tenantId: string,
  branchIds: readonly string[],
  options?: {
    txLimit?: number;
    dateRange?: DateRangeFilter;
    includeAr?: boolean;
  },
): Promise<FinanceOverviewReport> {
  const txLimit = options?.txLimit ?? 500;
  const includeAr = options?.includeAr ?? true;

  const branches = await Promise.all(
    branchIds.map(async (branchId) => {
      const [accounts, transactions, arSummary] = await Promise.all([
        listCashAccounts(tenantId, branchId, { activeOnly: true }),
        listCashTransactions(tenantId, branchId, {
          dateRange: options?.dateRange,
          limit: txLimit,
        }),
        includeAr
          ? getArSummary(tenantId, branchId)
          : Promise.resolve({ total: 0, overdue: 0, unpaid: 0, partial: 0 }),
      ]);
      return { branchId, accounts, transactions, arSummary };
    }),
  );

  return { branches };
}

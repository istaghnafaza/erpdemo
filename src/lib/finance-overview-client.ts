// =============================================================================
// Finance overview client loader — shared by useFinance, useCashBook, prefetch
// =============================================================================

import { getFinanceOverview } from "@/lib/api/finance";
import type { MockCashTxWithAccount } from "@/lib/mock-finance";
import type { ReceivablesSummary } from "@/lib/receivables-calculations";
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

export interface FinanceOverviewData {
  accounts: CashAccount[];
  transactions: MockCashTxWithAccount[];
  receivablesSummary: ReceivablesSummary;
}

export async function fetchFinanceOverview(
  tenantId: string,
  branchIds: readonly string[],
  options?: { includeAr?: boolean; dateFrom?: string; dateTo?: string },
): Promise<FinanceOverviewData> {
  const emptyAr: ReceivablesSummary = {
    totalOutstanding: 0,
    newThisMonth: 0,
    collectedThisMonth: 0,
    overdue: 0,
    activeInvoiceCount: 0,
  };

  if (branchIds.length === 0) {
    return { accounts: [], transactions: [], receivablesSummary: emptyAr };
  }

  const result = await getFinanceOverview(tenantId, branchIds, {
    includeAr: options?.includeAr ?? true,
    dateRange:
      options?.dateFrom || options?.dateTo
        ? { from: options?.dateFrom ?? "", to: options?.dateTo ?? "" }
        : undefined,
    txLimit: 500,
  });
  if (result.error) throw new Error(result.error);

  const branches = result.data?.branches ?? [];
  const receivablesSummary = branches.reduce(
    (acc, slice) => ({
      totalOutstanding: acc.totalOutstanding + slice.arSummary.total,
      newThisMonth: acc.newThisMonth,
      collectedThisMonth: acc.collectedThisMonth,
      overdue: acc.overdue + slice.arSummary.overdue,
      activeInvoiceCount:
        acc.activeInvoiceCount + slice.arSummary.unpaid + slice.arSummary.partial,
    }),
    { ...emptyAr },
  );

  return {
    accounts: branches.flatMap((b) => b.accounts),
    transactions: branches.flatMap((b) => b.transactions) as MockCashTxWithAccount[],
    receivablesSummary,
  };
}

export async function fetchCashBookOverview(
  tenantId: string,
  branchIds: readonly string[],
  dateFrom: string,
  dateTo: string,
): Promise<{ accounts: CashAccount[]; transactions: MockCashTxWithAccount[] }> {
  const data = await fetchFinanceOverview(tenantId, branchIds, {
    includeAr: false,
    dateFrom,
    dateTo,
  });
  return { accounts: data.accounts, transactions: data.transactions };
}

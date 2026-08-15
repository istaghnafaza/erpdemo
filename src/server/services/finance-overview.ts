// =============================================================================
// Finance overview bundle — 1 server fn for dashboard keuangan (Fase B P1)
// =============================================================================

import { listCashAccounts, listCashTransactions } from "@/server/services/finance";
import { getArSummary } from "@/server/services/receivables";
import { getUnifiedProfitLoss } from "@/server/services/pnl";
import { getMonthDateRange, type ProfitLossSummary } from "@/lib/finance-calculations";
import type { DateRangeFilter } from "@/types/app";
import type { CashAccount, CashTransaction } from "@/types/database";

export interface FinanceOverviewBranchSlice {
  branchId: string;
  accounts: CashAccount[];
  transactions: CashTransaction[];
  arSummary: { total: number; overdue: number; unpaid: number; partial: number };
  profitLoss: ProfitLossSummary;
}

export interface FinanceOverviewReport {
  branches: FinanceOverviewBranchSlice[];
  profitLoss: ProfitLossSummary;
}

function mergePnl(parts: ProfitLossSummary[]): ProfitLossSummary {
  const sales = parts.reduce((s, p) => s + p.sales, 0);
  const salesMargin = parts.reduce((s, p) => s + p.salesMargin, 0);
  const opex = parts.reduce((s, p) => s + p.opex, 0);
  const cogs = Math.max(0, sales - salesMargin);
  const grossProfit = salesMargin;
  const netProfit = grossProfit - opex;
  return {
    sales,
    salesMargin,
    cogs,
    grossProfit,
    opex,
    netProfit,
    marginPct: sales > 0 ? Math.round((netProfit / sales) * 100) : 0,
    grossMarginPct: sales > 0 ? Math.round((salesMargin / sales) * 100) : 0,
  };
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
  const monthRange = getMonthDateRange();

  const branches = await Promise.all(
    branchIds.map(async (branchId) => {
      const [accounts, transactions, arSummary, profitLoss] = await Promise.all([
        listCashAccounts(tenantId, branchId, { activeOnly: true }),
        listCashTransactions(tenantId, branchId, {
          dateRange: options?.dateRange,
          limit: txLimit,
        }),
        includeAr
          ? getArSummary(tenantId, branchId)
          : Promise.resolve({ total: 0, overdue: 0, unpaid: 0, partial: 0 }),
        getUnifiedProfitLoss(tenantId, branchId, monthRange),
      ]);
      return { branchId, accounts, transactions, arSummary, profitLoss };
    }),
  );

  return {
    branches,
    profitLoss: mergePnl(branches.map((b) => b.profitLoss)),
  };
}

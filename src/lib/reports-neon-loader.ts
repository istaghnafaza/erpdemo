// =============================================================================
// Neon reports loader — data laporan dari database, bukan mock-data.ts
// =============================================================================

import { getReportsBundle } from "@/lib/api/reports";
import type { ProfitLossSummary } from "@/lib/finance-calculations";
import type {
  CashierAuditRow,
  CashierTransactionRow,
  OpnameVarianceRow,
  ReportPeriod,
  SalesDayRow,
  SalesSummary,
  TopProductRow,
} from "@/lib/reports-calculations";
import type { DateRangeFilter } from "@/types/app";

export function periodToDateRange(period: ReportPeriod): DateRangeFilter {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - Number(period) + 1);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

export interface NeonReportsBundle {
  salesReport: { chart: SalesDayRow[]; summary: SalesSummary };
  topProducts: TopProductRow[];
  paymentMethods: { name: string; value: number }[];
  profitLoss: ProfitLossSummary;
  cashierAudit: { cashiers: CashierAuditRow[]; transactions: CashierTransactionRow[] };
  opnameVariance: OpnameVarianceRow[];
}

export async function loadNeonReports(
  tenantId: string,
  branchIds: string[],
  period: ReportPeriod,
  monthRange: { from: string; to: string },
): Promise<NeonReportsBundle> {
  const result = await getReportsBundle(tenantId, branchIds, Number(period), monthRange);
  if (result.error || !result.data) {
    throw new Error(result.error ?? "Gagal memuat laporan");
  }

  const bundle = result.data;
  return {
    salesReport: bundle.salesReport,
    topProducts: bundle.topProducts,
    paymentMethods: bundle.paymentMethods,
    profitLoss: bundle.profitLoss,
    cashierAudit: { cashiers: [], transactions: [] },
    opnameVariance: [],
  };
}

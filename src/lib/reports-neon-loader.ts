// =============================================================================
// Neon reports loader — data laporan dari database, bukan mock-data.ts
// =============================================================================

import { getDailySales, getProfitLossSummary, getTopProducts } from "@/lib/api/reports";
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

function formatDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function periodToDateRange(period: ReportPeriod): DateRangeFilter {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - Number(period) + 1);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function buildEmptySalesChart(period: ReportPeriod): SalesDayRow[] {
  const days = Number(period);
  const rows: SalesDayRow[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const date = d.toISOString().split("T")[0]!;
    rows.push({ date, label: formatDayLabel(date), total: 0, transactions: 0 });
  }
  return rows;
}

export interface NeonReportsBundle {
  salesReport: { chart: SalesDayRow[]; summary: SalesSummary };
  topProducts: TopProductRow[];
  paymentMethods: { name: string; value: number }[];
  profitLoss: ProfitLossSummary;
  cashierAudit: { cashiers: CashierAuditRow[]; transactions: CashierTransactionRow[] };
  opnameVariance: OpnameVarianceRow[];
}

const EMPTY_PROFIT_LOSS: ProfitLossSummary = {
  sales: 0,
  salesMargin: 0,
  cogs: 0,
  grossProfit: 0,
  opex: 0,
  netProfit: 0,
  marginPct: 0,
  grossMarginPct: 0,
};

export async function loadNeonReports(
  tenantId: string,
  branchIds: string[],
  period: ReportPeriod,
  monthRange: { from: string; to: string },
): Promise<NeonReportsBundle> {
  if (branchIds.length === 0) {
    return {
      salesReport: {
        chart: buildEmptySalesChart(period),
        summary: { totalSales: 0, totalTransactions: 0, avgTicket: 0 },
      },
      topProducts: [],
      paymentMethods: [],
      profitLoss: EMPTY_PROFIT_LOSS,
      cashierAudit: { cashiers: [], transactions: [] },
      opnameVariance: [],
    };
  }

  const dateRange = periodToDateRange(period);
  const dayMap = new Map<string, SalesDayRow>();
  for (const row of buildEmptySalesChart(period)) {
    dayMap.set(row.date, { ...row });
  }

  let payCash = 0;
  let payTransfer = 0;
  let payQris = 0;
  let payCredit = 0;

  const productMap = new Map<string, TopProductRow>();

  let plRevenue = 0;
  let plCogs = 0;
  let plGross = 0;

  await Promise.all(
    branchIds.map(async (branchId) => {
      const [dailyResult, topResult, plResult] = await Promise.all([
        getDailySales(tenantId, branchId, dateRange),
        getTopProducts(tenantId, branchId, dateRange, 15),
        getProfitLossSummary(tenantId, branchId, monthRange),
      ]);

      for (const day of dailyResult.data ?? []) {
        const existing = dayMap.get(day.date);
        if (existing) {
          existing.total += day.totalRevenue;
          existing.transactions += day.totalTransactions;
        }
        payCash += day.cashRevenue;
        payTransfer += day.transferRevenue;
        payQris += day.qrisRevenue;
        payCredit += day.creditRevenue;
      }

      for (const p of topResult.data ?? []) {
        const key = p.sku || p.productId;
        const prev = productMap.get(key);
        if (prev) {
          prev.qty += p.totalQty;
          prev.revenue += p.totalRevenue;
        } else {
          productMap.set(key, {
            sku: p.sku,
            name: p.productName,
            qty: p.totalQty,
            revenue: p.totalRevenue,
          });
        }
      }

      if (plResult.data) {
        plRevenue += plResult.data.revenue;
        plCogs += plResult.data.cogs;
        plGross += plResult.data.grossProfit;
      }
    }),
  );

  const chart = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const totalSales = chart.reduce((s, r) => s + r.total, 0);
  const totalTransactions = chart.reduce((s, r) => s + r.transactions, 0);

  const payTotal = payCash + payTransfer + payQris + payCredit;
  const paymentMethods =
    payTotal > 0
      ? [
          { name: "Tunai", value: Math.round((payCash / payTotal) * 100) },
          { name: "Transfer", value: Math.round((payTransfer / payTotal) * 100) },
          { name: "QRIS", value: Math.round((payQris / payTotal) * 100) },
          { name: "Piutang", value: Math.round((payCredit / payTotal) * 100) },
        ].filter((x) => x.value > 0)
      : [];

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const profitLoss: ProfitLossSummary = {
    sales: plRevenue,
    salesMargin: plGross,
    cogs: plCogs,
    grossProfit: plGross,
    opex: 0,
    netProfit: plGross,
    marginPct: plRevenue > 0 ? Math.round((plGross / plRevenue) * 100) : 0,
    grossMarginPct: plRevenue > 0 ? Math.round((plGross / plRevenue) * 100) : 0,
  };

  return {
    salesReport: {
      chart,
      summary: {
        totalSales,
        totalTransactions,
        avgTicket: totalTransactions > 0 ? Math.round(totalSales / totalTransactions) : 0,
      },
    },
    topProducts,
    paymentMethods,
    profitLoss,
    cashierAudit: { cashiers: [], transactions: [] },
    opnameVariance: [],
  };
}

// =============================================================================
// useDashboard — business logic for the Dashboard module (Fase 6).
//
// Per Aturan 3 (Logic Separation): all KPI/chart/aggregation math lives here,
// not in the route component — the component only renders what this hook
// returns.
//
// Demo mode (loginAsMock): figures come from src/lib/mock-data.ts so numbers
// stay consistent with every other module (POS, inventory, AR/AP) — same
// source `AppShell`, `NotificationPanel`, etc. already rely on. Once real
// Supabase Auth lands (Fase 15), this hook is the only place that needs to
// switch to `src/lib/api/reports.ts` (getDashboardStats / getTopProducts /
// getBranchSummaries — already implemented and ready).
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore, MOCK_TENANT_ID } from "@/stores/auth.store";
import { isMockTenantId } from "@/lib/mock-session";
import { useBranchStore } from "@/stores/branch.store";
import { useNotificationStore } from "@/stores/notification.store";
import { useFinanceStore } from "@/stores/finance.store";
import { useReceivablesStore } from "@/stores/receivables.store";
import { usePayablesStore } from "@/stores/payables.store";
import { useSalesTransactionsStore } from "@/stores/sales-transactions.store";
import { getDashboardBundle } from "@/lib/api/reports";
import { useCashflowDashboardKpis } from "@/hooks/useCashflowIntelligence";
import { queryKeys } from "@/lib/query-keys";
import {
  PRODUCTS,
  SALES_HISTORY,
  TOP_PRODUCTS,
  stockStatus,
} from "@/lib/mock-data";
import { computeProfitLoss, getMonthDateRange } from "@/lib/finance-calculations";
import { computeReceivablesSummary } from "@/lib/receivables-calculations";
import { filterFinanceByBranches } from "@/lib/finance-scope";
import { resolveScopedBranchIds, mergeDashboardStats, mergeTopProducts } from "@/lib/branch-scope";
import {
  mergeTopProductsByProfit,
  topProfitableFromSalesRecords,
  type TopProfitableProductRow,
} from "@/lib/sales-margin";
import { daysBetween } from "@/lib/format";

export type DashboardPeriod = "today" | "week" | "month";

export interface DashboardPeriodSales {
  total: number;
  transactions: number;
  /** undefined when there's no prior window to compare against (e.g. month-over-month with only 30d of history) */
  deltaPct: number | undefined;
  label: string;
  compareLabel: string;
}

export interface DashboardPeriodProfit {
  grossProfit: number;
  netProfit: number;
  opex: number;
  grossMarginPct: number;
  deltaGrossPct: number | undefined;
  deltaNetPct: number | undefined;
  label: string;
  compareLabel: string;
}

function pctDelta(current: number, previous: number): number | undefined {
  if (previous <= 0) return undefined;
  return ((current - previous) / previous) * 100;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayRange(offsetDays = 0): { from: string; to: string } {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const key = localDateKey(d);
  return { from: key, to: key };
}

export interface DashboardBranchRow {
  branchId: string;
  branchName: string;
  revenue: number;
  transactions: number;
  grossProfit: number;
  netProfit: number;
  grossMarginPct: number;
  criticalStock: number;
  activeReceivables: number;
}

function statsMetricsForPeriod(
  stats: import("@/types/app").DashboardStats,
  period: DashboardPeriod,
): {
  revenue: number;
  transactions: number;
  grossProfit: number;
  netProfit: number;
} {
  if (period === "today") {
    return {
      revenue: stats.todayRevenue,
      transactions: stats.todayTransactions,
      grossProfit: stats.todayGrossProfit,
      netProfit: stats.todayNetProfit,
    };
  }
  if (period === "week") {
    return {
      revenue: stats.weekRevenue,
      transactions: 0,
      grossProfit: stats.weekGrossProfit,
      netProfit: stats.weekNetProfit,
    };
  }
  return {
    revenue: stats.monthRevenue,
    transactions: 0,
    grossProfit: stats.monthGrossProfit,
    netProfit: stats.monthNetProfit,
  };
}

const PERIOD_WINDOWS: Record<DashboardPeriod, { days: number; label: string; compareLabel: string }> = {
  today: { days: 1, label: "Hari Ini", compareLabel: "kemarin" },
  week: { days: 7, label: "Minggu Ini", compareLabel: "minggu lalu" },
  month: { days: 30, label: "Bulan Ini", compareLabel: "bulan lalu" },
};

// Deterministic revenue split — hanya dipakai demo mock bila belum ada stats per cabang.
const CONSOLIDATED_WEIGHTS = [0.55, 0.3, 0.15];

export function useDashboard() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const tenantId = currentUser?.tenantId ?? "";
  const isMockTenant = isMockTenantId(tenantId);
  const branches = useBranchStore((s) => s.branches);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const setActiveBranch = useBranchStore((s) => s.setActiveBranch);
  const mockAccounts = useFinanceStore((s) => s.mockCashAccounts);
  const mockTransactions = useFinanceStore((s) => s.mockCashTransactions);
  const initializeMockFinance = useFinanceStore((s) => s.initializeMockFinance);
  const syncHistoricalArApPayments = useFinanceStore((s) => s.syncHistoricalArApPayments);
  const mockReceivables = useReceivablesStore((s) => s.mockReceivables);
  const mockArPayments = useReceivablesStore((s) => s.mockPayments);
  const mockPayables = usePayablesStore((s) => s.mockPayables);
  const mockApPayments = usePayablesStore((s) => s.mockPayments);
  const mockSales = useSalesTransactionsStore((s) => s.transactions);
  // Select the raw array + memoize the filter below — selecting via an
  // inline `.filter()` selector (e.g. the store's `selectNotifications`
  // helper) returns a new array reference every render, which trips
  // React 19's useSyncExternalStore into an infinite update loop.
  const allNotifications = useNotificationStore((s) => s.notifications);
  const cashflowKpisQuery = useCashflowDashboardKpis();
  const cashflowKpis = cashflowKpisQuery.data ?? null;

  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const [mockLoading, setMockLoading] = useState(true);

  const user = currentUser?.profile ?? null;
  const isOwner = user?.role === "owner";

  const branchIds = useMemo(
    () =>
      resolveScopedBranchIds({
        branches,
        activeBranch,
        isConsolidated,
        isOwner,
      }),
    [isConsolidated, isOwner, branches, activeBranch],
  );

  // Demo mock: brief skeleton on first paint (Neon uses query pending state).
  useEffect(() => {
    if (!isMockTenant) return;
    const timer = setTimeout(() => setMockLoading(false), 400);
    return () => clearTimeout(timer);
  }, [isMockTenant]);

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboardBundle(tenantId, branchIds),
    queryFn: async () => {
      const result = await getDashboardBundle(tenantId, branchIds);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: !isMockTenant && Boolean(tenantId) && branchIds.length > 0,
  });

  const branchStatsById = useMemo(
    () =>
      Object.fromEntries(
        (dashboardQuery.data?.branches ?? []).map((b) => [b.branchId, b.stats]),
      ),
    [dashboardQuery.data],
  );

  const neonStats = useMemo(() => {
    const stats = dashboardQuery.data?.branches.map((b) => b.stats) ?? [];
    return stats.length > 0 ? mergeDashboardStats(stats) : null;
  }, [dashboardQuery.data]);

  const neonTopProducts = useMemo(() => {
    const flat = dashboardQuery.data?.branches.flatMap((b) => b.topProducts30d) ?? [];
    return mergeTopProducts(flat, 10);
  }, [dashboardQuery.data]);

  const topProfitableToday = useMemo((): TopProfitableProductRow[] => {
    const flat = dashboardQuery.data?.branches.flatMap((b) => b.topProductsToday) ?? [];
    return mergeTopProductsByProfit(flat, 5);
  }, [dashboardQuery.data]);

  const isLoading = isMockTenant ? mockLoading : dashboardQuery.isPending;

  useEffect(() => {
    if (!isMockTenant) return;
    initializeMockFinance(mockSales);
    syncHistoricalArApPayments({
      receivables: mockReceivables,
      arPayments: mockArPayments,
      payables: mockPayables,
      apPayments: mockApPayments,
    });
  }, [
    isMockTenant,
    mockSales,
    mockReceivables,
    mockArPayments,
    mockPayables,
    mockApPayments,
    initializeMockFinance,
    syncHistoricalArApPayments,
  ]);

  const monthRange = useMemo(() => getMonthDateRange(), []);

  // ---------------------------------------------------------------------
  // Sales for the selected period (Hari Ini / Minggu Ini / Bulan Ini)
  // ---------------------------------------------------------------------
  const periodSales = useMemo<DashboardPeriodSales>(() => {
    if (!isMockTenant && neonStats) {
      const map = {
        today: {
          total: neonStats.todayRevenue,
          transactions: neonStats.todayTransactions,
          label: "Hari Ini",
          compareLabel: "kemarin",
          deltaPct: pctDelta(neonStats.todayRevenue, neonStats.yesterdayRevenue),
        },
        week: {
          total: neonStats.weekRevenue,
          transactions: 0,
          label: "Minggu Ini",
          compareLabel: "minggu lalu",
          deltaPct: undefined,
        },
        month: {
          total: neonStats.monthRevenue,
          transactions: 0,
          label: "Bulan Ini",
          compareLabel: "bulan lalu",
          deltaPct: undefined,
        },
      } as const;
      const current = map[period];
      return {
        total: current.total,
        transactions: current.transactions,
        deltaPct: current.deltaPct,
        label: current.label,
        compareLabel: current.compareLabel,
      };
    }

    const total = SALES_HISTORY.length;
    const { days, label, compareLabel } = PERIOD_WINDOWS[period];

    const sumWindow = (offsetFromEnd: number) => {
      const end = total - offsetFromEnd;
      const start = end - days;
      return SALES_HISTORY.slice(Math.max(start, 0), Math.max(end, 0)).reduce(
        (acc, d) => ({ total: acc.total + d.total, transactions: acc.transactions + d.transactions }),
        { total: 0, transactions: 0 },
      );
    };

    const current = sumWindow(0);
    const previous = sumWindow(days);
    const deltaPct =
      previous.total > 0 ? ((current.total - previous.total) / previous.total) * 100 : undefined;

    return { total: current.total, transactions: current.transactions, deltaPct, label, compareLabel };
  }, [period, isMockTenant, neonStats]);

  // ---------------------------------------------------------------------
  // Stock alerts
  // ---------------------------------------------------------------------
  const criticalProducts = useMemo(() => PRODUCTS.filter((p) => stockStatus(p) === "critical"), []);
  const lowStockProducts = useMemo(() => PRODUCTS.filter((p) => stockStatus(p) === "low"), []);

  // ---------------------------------------------------------------------
  // Piutang jatuh tempo
  // ---------------------------------------------------------------------
  const overdueReceivables = useMemo(() => {
    const today = new Date().toISOString();
    const scoped = branchIds.length
      ? mockReceivables.filter((r) => branchIds.includes(r.branchId))
      : mockReceivables;
    return scoped
      .filter((r) => r.amount - r.paid > 0 && daysBetween(today, r.dueDate) > 0)
      .sort((a, b) => daysBetween(today, b.dueDate) - daysBetween(today, a.dueDate));
  }, [mockReceivables, branchIds]);

  const overdueTotal = useMemo(
    () => overdueReceivables.reduce((s, r) => s + (r.amount - r.paid), 0),
    [overdueReceivables],
  );

  const overdueCustomerCount = useMemo(
    () => new Set(overdueReceivables.map((r) => r.customerId)).size,
    [overdueReceivables],
  );

  // ---------------------------------------------------------------------
  // Saldo Kas & Bank
  // ---------------------------------------------------------------------
  const scopedAccounts = useMemo(
    () => filterFinanceByBranches(mockAccounts, branchIds),
    [mockAccounts, branchIds],
  );

  const scopedTransactions = useMemo(
    () => filterFinanceByBranches(mockTransactions, branchIds),
    [mockTransactions, branchIds],
  );

  const scopedSales = useMemo(
    () =>
      mockSales.filter(
        (s) =>
          s.tenantId === tenantId &&
          s.status === "completed" &&
          (branchIds.length === 0 || branchIds.includes(s.branchId)),
      ),
    [mockSales, tenantId, branchIds],
  );

  const periodProfit = useMemo<DashboardPeriodProfit>(() => {
    if (!isMockTenant && neonStats) {
      const map = {
        today: {
          grossProfit: neonStats.todayGrossProfit,
          netProfit: neonStats.todayNetProfit,
          opex: neonStats.todayOpex,
          label: "Hari Ini",
          compareLabel: "kemarin",
          deltaGrossPct: pctDelta(neonStats.todayGrossProfit, neonStats.yesterdayGrossProfit),
          deltaNetPct: pctDelta(neonStats.todayNetProfit, neonStats.yesterdayNetProfit),
        },
        week: {
          grossProfit: neonStats.weekGrossProfit,
          netProfit: neonStats.weekNetProfit,
          opex: neonStats.weekGrossProfit - neonStats.weekNetProfit,
          label: "Minggu Ini",
          compareLabel: "minggu lalu",
          deltaGrossPct: undefined,
          deltaNetPct: undefined,
        },
        month: {
          grossProfit: neonStats.monthGrossProfit,
          netProfit: neonStats.monthNetProfit,
          opex: neonStats.monthOpex,
          label: "Bulan Ini",
          compareLabel: "bulan lalu",
          deltaGrossPct: undefined,
          deltaNetPct: undefined,
        },
      } as const;
      const current = map[period];
      const revenue =
        period === "today"
          ? neonStats.todayRevenue
          : period === "week"
            ? neonStats.weekRevenue
            : neonStats.monthRevenue;
      return {
        grossProfit: current.grossProfit,
        netProfit: current.netProfit,
        opex: current.opex,
        grossMarginPct: revenue > 0 ? Math.round((current.grossProfit / revenue) * 100) : 0,
        deltaGrossPct: current.deltaGrossPct,
        deltaNetPct: current.deltaNetPct,
        label: current.label,
        compareLabel: current.compareLabel,
      };
    }

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const ranges = {
      today: { current: dayRange(0), previous: dayRange(1) },
      week: { current: { from: localDateKey(weekStart), to: localDateKey(new Date()) }, previous: undefined },
      month: { current: monthRange, previous: undefined },
    } as const;
    const { current, previous } = ranges[period];

    const plCurrent = computeProfitLoss(
      scopedTransactions,
      current,
      isMockTenant ? scopedSales : undefined,
    );
    const plPrevious =
      previous &&
      computeProfitLoss(scopedTransactions, previous, isMockTenant ? scopedSales : undefined);

    return {
      grossProfit: plCurrent.grossProfit,
      netProfit: plCurrent.netProfit,
      opex: plCurrent.opex,
      grossMarginPct: plCurrent.grossMarginPct,
      deltaGrossPct:
        plPrevious && plPrevious.grossProfit > 0
          ? pctDelta(plCurrent.grossProfit, plPrevious.grossProfit)
          : undefined,
      deltaNetPct:
        plPrevious && plPrevious.netProfit > 0
          ? pctDelta(plCurrent.netProfit, plPrevious.netProfit)
          : undefined,
      label: PERIOD_WINDOWS[period].label,
      compareLabel: PERIOD_WINDOWS[period].compareLabel,
    };
  }, [period, isMockTenant, neonStats, scopedTransactions, scopedSales, monthRange]);

  const criticalStockCount =
    !isMockTenant && neonStats ? neonStats.criticalStockCount : criticalProducts.length;
  const lowStockCount =
    !isMockTenant && neonStats ? neonStats.lowStockCount : lowStockProducts.length;

  const totalCashBalance = useMemo(() => {
    if (!isMockTenant && neonStats) return neonStats.totalCashBalance;
    return scopedAccounts.reduce((s, a) => s + a.balance, 0);
  }, [isMockTenant, neonStats, scopedAccounts]);

  const cashAccountCount =
    !isMockTenant && neonStats ? neonStats.cashAccountCount : scopedAccounts.length;

  const resolvedOverdueTotal =
    !isMockTenant && neonStats ? neonStats.overdueAr : overdueTotal;

  const financeSummary = useMemo(() => {
    if (!isMockTenant && neonStats) {
      return {
        monthSales: neonStats.monthRevenue,
        monthSalesMargin: neonStats.monthGrossProfit,
        monthGrossProfit: neonStats.monthGrossProfit,
        monthOpex: neonStats.monthOpex,
        monthNetProfit: neonStats.monthNetProfit,
        totalReceivables: neonStats.totalAr,
        totalPayables: neonStats.totalAp,
        totalCash: neonStats.totalCashBalance,
      };
    }

    const pl = computeProfitLoss(
      scopedTransactions,
      monthRange,
      isMockTenant ? scopedSales : undefined,
    );
    const ar = computeReceivablesSummary(
      mockReceivables,
      mockArPayments,
      branchIds,
      monthRange,
    );
    const apOutstanding = (branchIds.length ? mockPayables.filter((p) => branchIds.includes(p.branchId)) : mockPayables)
      .reduce((s, p) => s + Math.max(0, p.amount - p.paid), 0);

    return {
      monthSales: pl.sales,
      monthSalesMargin: pl.salesMargin,
      monthGrossProfit: pl.salesMargin,
      monthOpex: pl.opex,
      monthNetProfit: pl.netProfit,
      totalReceivables: ar.totalOutstanding,
      totalPayables: apOutstanding,
      totalCash: totalCashBalance,
    };
  }, [
    scopedTransactions,
    monthRange,
    isMockTenant,
    scopedSales,
    mockReceivables,
    mockArPayments,
    mockPayables,
    branchIds,
    totalCashBalance,
    neonStats,
  ]);

  // ---------------------------------------------------------------------
  // Grafik penjualan — 30 hari terakhir (tetap, sesuai spesifikasi Fase 6)
  // ---------------------------------------------------------------------
  const salesChartData = useMemo(
    () => {
      if (!isMockTenant && neonStats?.revenueChartData.length) {
        return neonStats.revenueChartData.map((d) => ({
          date: d.date,
          Penjualan: d.totalRevenue,
          Transaksi: d.totalTransactions,
        }));
      }
      return SALES_HISTORY.map((d) => ({
        date: d.date,
        Penjualan: d.total,
        Transaksi: d.transactions,
      }));
    },
    [isMockTenant, neonStats],
  );

  // ---------------------------------------------------------------------
  // Notifikasi aktif — langsung dari notification.store (max 5, terbaru dulu)
  // ---------------------------------------------------------------------
  const recentNotifications = useMemo(
    () => allNotifications.filter((n) => !n.isDismissed).slice(0, 5),
    [allNotifications],
  );

  // ---------------------------------------------------------------------
  // Mode konsolidasi — ringkasan per cabang (khusus owner)
  // ---------------------------------------------------------------------
  const branchSummaries = useMemo<DashboardBranchRow[]>(() => {
    if (branches.length === 0 || !isConsolidated || !isOwner) return [];

    const mockMetricsForBranch = (branchId: string) => {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);
      const range =
        period === "today"
          ? dayRange(0)
          : period === "week"
            ? { from: localDateKey(weekStart), to: localDateKey(new Date()) }
            : monthRange;

      const branchSales = scopedSales.filter((s) => s.branchId === branchId);
      const pl = computeProfitLoss(
        scopedTransactions.filter((t) => t.branch_id === branchId),
        range,
        branchSales,
      );
      const completed = branchSales.filter(
        (s) => s.status === "completed" && s.createdAt.split("T")[0]! >= range.from && s.createdAt.split("T")[0]! <= range.to,
      );

      return {
        revenue: pl.sales,
        transactions: completed.length,
        grossProfit: pl.grossProfit,
        netProfit: pl.netProfit,
        grossMarginPct: pl.grossMarginPct,
      };
    };

    return branches.map((b, i) => {
      const stats = branchStatsById[b.id];
      if (stats) {
        const m = statsMetricsForPeriod(stats, period);
        return {
          branchId: b.id,
          branchName: b.name,
          revenue: m.revenue,
          transactions: m.transactions,
          grossProfit: m.grossProfit,
          netProfit: m.netProfit,
          grossMarginPct: m.revenue > 0 ? Math.round((m.grossProfit / m.revenue) * 100) : 0,
          criticalStock: stats.criticalStockCount,
          activeReceivables: stats.overdueAr,
        };
      }

      if (isMockTenant) {
        const m = mockMetricsForBranch(b.id);
        return {
          branchId: b.id,
          branchName: b.name,
          revenue: m.revenue,
          transactions: m.transactions,
          grossProfit: m.grossProfit,
          netProfit: m.netProfit,
          grossMarginPct: m.grossMarginPct,
          criticalStock: i === 0 ? criticalProducts.length : 0,
          activeReceivables: i === 0 ? overdueReceivables.length : 0,
        };
      }

      const w = (CONSOLIDATED_WEIGHTS[i] ?? 0.1) / CONSOLIDATED_WEIGHTS.reduce((s, x) => s + x, 0);
      return {
        branchId: b.id,
        branchName: b.name,
        revenue: Math.round(periodSales.total * w),
        transactions: Math.round(periodSales.transactions * w),
        grossProfit: Math.round(periodProfit.grossProfit * w),
        netProfit: Math.round(periodProfit.netProfit * w),
        grossMarginPct: periodProfit.grossMarginPct,
        criticalStock: 0,
        activeReceivables: 0,
      };
    });
  }, [
    branches,
    isConsolidated,
    isOwner,
    branchStatsById,
    period,
    isMockTenant,
    scopedSales,
    scopedTransactions,
    monthRange,
    criticalProducts.length,
    overdueReceivables.length,
    periodSales,
    periodProfit,
  ]);

  const branchSummaryTotals = useMemo(
    () =>
      branchSummaries.reduce(
        (acc, b) => ({
          revenue: acc.revenue + b.revenue,
          transactions: acc.transactions + b.transactions,
          grossProfit: acc.grossProfit + b.grossProfit,
          netProfit: acc.netProfit + b.netProfit,
          criticalStock: acc.criticalStock + b.criticalStock,
          activeReceivables: acc.activeReceivables + b.activeReceivables,
        }),
        {
          revenue: 0,
          transactions: 0,
          grossProfit: 0,
          netProfit: 0,
          criticalStock: 0,
          activeReceivables: 0,
        },
      ),
    [branchSummaries],
  );

  const mockTopProfitableToday = useMemo(
    () => topProfitableFromSalesRecords(scopedSales, dayRange(0)),
    [scopedSales],
  );

  const resolvedTopProfitableToday = isMockTenant ? mockTopProfitableToday : topProfitableToday;

  return {
    user,
    isOwner,
    isConsolidated,
    isLoading,

    period,
    setPeriod,
    periodSales,
    periodProfit,

    criticalProducts,
    lowStockProducts,
    criticalStockCount,
    lowStockCount,

    overdueReceivables,
    overdueTotal: resolvedOverdueTotal,
    overdueCustomerCount,

    totalCashBalance,
    cashAccountCount,

    salesChartData,
    topProducts: isMockTenant ? TOP_PRODUCTS : neonTopProducts,
    topProfitableToday: resolvedTopProfitableToday,
    financeSummary,

    cashflowKpis,

    recentNotifications,

    branches,
    branchSummaries,
    branchSummaryTotals,
    activeBranch,
    setActiveBranch,
  };
}

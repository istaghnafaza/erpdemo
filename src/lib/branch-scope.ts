// =============================================================================
// Branch scope — resolve query filters from dropdown (single cabang / konsolidasi).
// Hanya cabang aktif di store yang dipakai; cabang nonaktif/history diabaikan.
// =============================================================================

import type { Branch } from "@/types/database";
import type { DashboardStats, TopProduct } from "@/types/app";

export function isOwnerConsolidatedView(
  isConsolidated: boolean,
  isOwner: boolean,
): boolean {
  return isConsolidated && isOwner;
}

/** Cabang aktif yang valid — objek dari list cabang aktif, bukan snapshot persist stale. */
export function resolveEffectiveActiveBranch(
  branches: Branch[],
  activeBranch: Branch | null,
): Branch | null {
  if (activeBranch) {
    const match = branches.find((b) => b.id === activeBranch.id);
    if (match) return match;
  }
  return branches[0] ?? null;
}

/** ID cabang untuk filter query API/store. */
export function resolveScopedBranchIds(params: {
  branches: Branch[];
  activeBranch: Branch | null;
  isConsolidated: boolean;
  isOwner: boolean;
}): string[] {
  const { branches, activeBranch, isConsolidated, isOwner } = params;
  if (isOwnerConsolidatedView(isConsolidated, isOwner)) {
    return branches.map((b) => b.id);
  }
  const effective = resolveEffectiveActiveBranch(branches, activeBranch);
  return effective ? [effective.id] : [];
}

export function mergeDashboardStats(stats: DashboardStats[]): DashboardStats {
  if (stats.length === 0) {
    return {
      todayRevenue: 0,
      todayTransactions: 0,
      todayGrossProfit: 0,
      todayNetProfit: 0,
      todayOpex: 0,
      yesterdayRevenue: 0,
      yesterdayTransactions: 0,
      yesterdayGrossProfit: 0,
      yesterdayNetProfit: 0,
      weekRevenue: 0,
      weekGrossProfit: 0,
      weekNetProfit: 0,
      monthRevenue: 0,
      monthGrossProfit: 0,
      monthNetProfit: 0,
      monthOpex: 0,
      totalAr: 0,
      totalAp: 0,
      overdueAr: 0,
      lowStockCount: 0,
      criticalStockCount: 0,
      totalCashBalance: 0,
      cashAccountCount: 0,
      revenueChartData: [],
    };
  }
  if (stats.length === 1) return stats[0];

  const chartByDate = new Map<string, DashboardStats["revenueChartData"][number]>();
  for (const stat of stats) {
    for (const day of stat.revenueChartData) {
      const existing = chartByDate.get(day.date);
      if (!existing) {
        chartByDate.set(day.date, { ...day });
        continue;
      }
      existing.totalRevenue += day.totalRevenue;
      existing.totalTransactions += day.totalTransactions;
      existing.cashRevenue += day.cashRevenue;
      existing.transferRevenue += day.transferRevenue;
      existing.qrisRevenue += day.qrisRevenue;
      existing.creditRevenue += day.creditRevenue;
    }
  }

  return {
    todayRevenue: stats.reduce((s, x) => s + x.todayRevenue, 0),
    todayTransactions: stats.reduce((s, x) => s + x.todayTransactions, 0),
    todayGrossProfit: stats.reduce((s, x) => s + x.todayGrossProfit, 0),
    todayNetProfit: stats.reduce((s, x) => s + x.todayNetProfit, 0),
    todayOpex: stats.reduce((s, x) => s + x.todayOpex, 0),
    yesterdayRevenue: stats.reduce((s, x) => s + x.yesterdayRevenue, 0),
    yesterdayTransactions: stats.reduce((s, x) => s + x.yesterdayTransactions, 0),
    yesterdayGrossProfit: stats.reduce((s, x) => s + x.yesterdayGrossProfit, 0),
    yesterdayNetProfit: stats.reduce((s, x) => s + x.yesterdayNetProfit, 0),
    weekRevenue: stats.reduce((s, x) => s + x.weekRevenue, 0),
    weekGrossProfit: stats.reduce((s, x) => s + x.weekGrossProfit, 0),
    weekNetProfit: stats.reduce((s, x) => s + x.weekNetProfit, 0),
    monthRevenue: stats.reduce((s, x) => s + x.monthRevenue, 0),
    monthGrossProfit: stats.reduce((s, x) => s + x.monthGrossProfit, 0),
    monthNetProfit: stats.reduce((s, x) => s + x.monthNetProfit, 0),
    monthOpex: stats.reduce((s, x) => s + x.monthOpex, 0),
    totalAr: stats.reduce((s, x) => s + x.totalAr, 0),
    totalAp: stats.reduce((s, x) => s + x.totalAp, 0),
    overdueAr: stats.reduce((s, x) => s + x.overdueAr, 0),
    lowStockCount: stats.reduce((s, x) => s + x.lowStockCount, 0),
    criticalStockCount: stats.reduce((s, x) => s + x.criticalStockCount, 0),
    totalCashBalance: stats.reduce((s, x) => s + x.totalCashBalance, 0),
    cashAccountCount: stats.reduce((s, x) => s + x.cashAccountCount, 0),
    revenueChartData: Array.from(chartByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  };
}

export function mergeTopProducts(items: TopProduct[], limit = 10): TopProduct[] {
  const byKey = new Map<string, TopProduct>();
  for (const item of items) {
    const key = item.productId || item.sku;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item });
      continue;
    }
    existing.totalQty += item.totalQty;
    existing.totalRevenue += item.totalRevenue;
    existing.totalProfit += item.totalProfit;
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

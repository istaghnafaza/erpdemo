// =============================================================================
// Reports service — dashboard & laporan aggregations (Phase 5)
// =============================================================================

import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getReadDb } from "@/server/db";
import {
  effectiveItemSubtotal,
  toQtyNumber,
} from "@/lib/sales-margin";
import {
  getUnifiedProfitLoss,
  loadPnlSource,
  summarizePnlSource,
} from "@/server/services/pnl";
import type {
  CashierAuditRow,
  CashierTransactionRow,
} from "@/lib/reports-calculations";
import {
  branchProducts,
  branches,
  dailyBranchSales,
  products,
  profiles,
  salesItems,
  salesTransactions,
} from "@/server/db/schema";
import { listCashAccounts } from "@/server/services/finance";
import { getApSummary } from "@/server/services/payables";
import { getArSummary } from "@/server/services/receivables";
import type {
  BranchSummary,
  DashboardBranchBundle,
  DailySalesSummary,
  DashboardStats,
  DateRangeFilter,
  ReportsBundle,
  StockAlertItem,
  StockStatus,
  TopProduct,
} from "@/types/app";

import {
  addDaysToDateKey,
  dateKeyInAppTz,
  monthStartKeyFromDateKey,
  todayKeyInAppTz,
  utcRangeForAppDateKey,
} from "@/lib/app-timezone";

function aggregateRowToDaily(row: typeof dailyBranchSales.$inferSelect): DailySalesSummary {
  return {
    date: row.saleDate,
    totalRevenue: row.totalRevenue,
    totalTransactions: row.txCount,
    cashRevenue: row.cashRevenue,
    transferRevenue: row.transferRevenue,
    qrisRevenue: row.qrisRevenue,
    creditRevenue: row.creditRevenue,
  };
}

async function getDailySalesFromRaw(
  tenantId: string,
  branchId: string,
  dateRange: DateRangeFilter,
): Promise<DailySalesSummary[]> {
  const db = getReadDb();
  const rows = await db.query.salesTransactions.findMany({
    where: and(
      eq(salesTransactions.tenantId, tenantId),
      eq(salesTransactions.branchId, branchId),
      eq(salesTransactions.status, "completed"),
      gte(salesTransactions.createdAt, new Date(dateRange.from)),
      lte(salesTransactions.createdAt, new Date(dateRange.to)),
    ),
    orderBy: [salesTransactions.createdAt],
  });

  const byDate = new Map<string, DailySalesSummary>();

  for (const tx of rows) {
    const date = dateKeyInAppTz(tx.createdAt);
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        totalRevenue: 0,
        totalTransactions: 0,
        cashRevenue: 0,
        transferRevenue: 0,
        qrisRevenue: 0,
        creditRevenue: 0,
      });
    }
    const day = byDate.get(date)!;
    day.totalRevenue += tx.grandTotal;
    day.totalTransactions += 1;

    const pm = tx.paymentMethod;
    if (pm === "cash") day.cashRevenue += tx.grandTotal;
    else if (pm === "transfer") day.transferRevenue += tx.grandTotal;
    else if (["qris_edc", "qris_gopay", "qris_ovo", "qris_other"].includes(pm)) {
      day.qrisRevenue += tx.grandTotal;
    } else if (pm === "credit") day.creditRevenue += tx.grandTotal;
  }

  return Array.from(byDate.values());
}

export async function getDailySalesReport(
  tenantId: string,
  branchId: string,
  dateRange: DateRangeFilter,
): Promise<DailySalesSummary[]> {
  const db = getReadDb();
  const fromDate = dateRange.from.split("T")[0]!;
  const toDate = dateRange.to.split("T")[0]!;
  const today = todayKeyInAppTz();

  const aggRows = await db.query.dailyBranchSales.findMany({
    where: and(
      eq(dailyBranchSales.tenantId, tenantId),
      eq(dailyBranchSales.branchId, branchId),
      gte(dailyBranchSales.saleDate, fromDate),
      lte(dailyBranchSales.saleDate, toDate),
    ),
  });

  if (aggRows.length === 0) {
    return getDailySalesFromRaw(tenantId, branchId, dateRange);
  }

  const byDate = new Map<string, DailySalesSummary>();
  for (const row of aggRows) {
    if (row.saleDate === today) continue;
    byDate.set(row.saleDate, aggregateRowToDaily(row));
  }

  if (toDate >= today && fromDate <= today) {
    const { from, to } = utcRangeForAppDateKey(today);
    const todayRows = await getDailySalesFromRaw(tenantId, branchId, {
      from: from.toISOString(),
      to: to.toISOString(),
    });
    for (const day of todayRows) {
      byDate.set(day.date, day);
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTopProductsReport(
  tenantId: string,
  branchId: string,
  dateRange: DateRangeFilter,
  limit = 10,
): Promise<TopProduct[]> {
  const db = getReadDb();

  const rows = await db
    .select({
      productId: salesItems.productId,
      productName: salesItems.productName,
      sku: salesItems.sku,
      unit: salesItems.unit,
      qty: salesItems.qty,
      purchasePrice: salesItems.purchasePrice,
      sellingPrice: salesItems.sellingPrice,
      subtotal: salesItems.subtotal,
      isSoLine: salesItems.isSoLine,
    })
    .from(salesItems)
    .innerJoin(salesTransactions, eq(salesItems.transactionId, salesTransactions.id))
    .where(
      and(
        eq(salesItems.tenantId, tenantId),
        eq(salesTransactions.branchId, branchId),
        eq(salesTransactions.status, "completed"),
        gte(salesTransactions.createdAt, new Date(dateRange.from)),
        lte(salesTransactions.createdAt, new Date(dateRange.to)),
      ),
    );

  const productMap = new Map<string, TopProduct>();

  for (const item of rows) {
    if (item.isSoLine) continue;
    const key = item.productId ?? item.sku;
    if (!productMap.has(key)) {
      productMap.set(key, {
        productId: item.productId ?? "",
        productName: item.productName,
        sku: item.sku,
        unit: item.unit,
        totalQty: 0,
        totalRevenue: 0,
        totalProfit: 0,
      });
    }
    const p = productMap.get(key)!;
    p.totalQty += toQtyNumber(item.qty);
    p.totalRevenue += item.subtotal;
    p.totalProfit += (item.sellingPrice - item.purchasePrice) * toQtyNumber(item.qty);
  }

  return Array.from(productMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

export async function getBranchSummariesReport(
  tenantId: string,
  dateRange: DateRangeFilter,
): Promise<BranchSummary[]> {
  const db = getReadDb();
  const branchRows = await db.query.branches.findMany({
    where: and(eq(branches.tenantId, tenantId), eq(branches.isActive, true)),
  });

  const txRows = await db.query.salesTransactions.findMany({
    where: and(
      eq(salesTransactions.tenantId, tenantId),
      eq(salesTransactions.status, "completed"),
      gte(salesTransactions.createdAt, new Date(dateRange.from)),
      lte(salesTransactions.createdAt, new Date(dateRange.to)),
    ),
  });

  const stockRows = await db.query.branchProducts.findMany({
    where: eq(branchProducts.tenantId, tenantId),
  });

  const summaries: BranchSummary[] = branchRows.map((branch) => {
    const branchTx = txRows.filter((t) => t.branchId === branch.id);
    return {
      branchId: branch.id,
      branchName: branch.name,
      totalRevenue: branchTx.reduce((s, t) => s + t.grandTotal, 0),
      totalTransactions: branchTx.length,
      stockAlerts: 0,
    };
  });

  for (const s of stockRows) {
    const bSummary = summaries.find((b) => b.branchId === s.branchId);
    if (bSummary && toQtyNumber(s.stock) <= s.reorderPoint) {
      bSummary.stockAlerts += 1;
    }
  }

  return summaries;
}

export async function getStockAlertsReport(
  tenantId: string,
  branchId?: string,
): Promise<StockAlertItem[]> {
  const db = getReadDb();
  const conditions = [eq(branchProducts.tenantId, tenantId)];
  if (branchId) conditions.push(eq(branchProducts.branchId, branchId));

  const bpRows = await db.query.branchProducts.findMany({
    where: and(...conditions),
  });

  const branchRows = await db.query.branches.findMany({
    where: eq(branches.tenantId, tenantId),
  });
  const productRows = await db.query.products.findMany({
    where: eq(products.tenantId, tenantId),
  });

  const branchMap = new Map(branchRows.map((b) => [b.id, b.name]));
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  const alerts: StockAlertItem[] = [];

  for (const bp of bpRows) {
    if (toQtyNumber(bp.stock) > bp.reorderPoint) continue;
    const p = productMap.get(bp.productId);
    const stockNow = toQtyNumber(bp.stock);
    const stockStatus: StockStatus = stockNow <= bp.reorderPoint * 0.4 ? "critical" : "low";

    alerts.push({
      branchProductId: bp.id,
      productId: bp.productId,
      sku: p?.sku ?? "",
      productName: p?.name ?? "",
      unit: p?.unit ?? "",
      branchId: bp.branchId,
      branchName: branchMap.get(bp.branchId) ?? "",
      stock: stockNow,
      legacyStock: toQtyNumber(bp.legacyStock),
      reorderPoint: bp.reorderPoint,
      stockStatus,
    });
  }

  return alerts;
}

/** Alias — periode dashboard memakai tanggal WIB, selaras histori penjualan. */
function txDateKey(iso: Date | string): string {
  return dateKeyInAppTz(iso);
}

const DASHBOARD_SALE_STATUSES = ["completed", "returned"] as const;

export async function getDashboardStatsReport(
  tenantId: string,
  branchId: string,
): Promise<DashboardStats> {
  const todayStr = todayKeyInAppTz();
  const yesterdayStr = addDaysToDateKey(todayStr, -1);
  const weekStartStr = addDaysToDateKey(todayStr, -6);
  const monthStartStr = monthStartKeyFromDateKey(todayStr);
  const last30Str = addDaysToDateKey(todayStr, -29);

  const db = getReadDb();
  const { from: last30From } = utcRangeForAppDateKey(last30Str);
  const txAll = await db.query.salesTransactions.findMany({
    where: and(
      eq(salesTransactions.tenantId, tenantId),
      eq(salesTransactions.branchId, branchId),
      inArray(salesTransactions.status, [...DASHBOARD_SALE_STATUSES]),
      gte(salesTransactions.createdAt, last30From),
    ),
  });

  const salesItemRows = await db
    .select({
      transactionId: salesItems.transactionId,
      qty: salesItems.qty,
      qtyReturned: salesItems.qtyReturned,
      purchasePrice: salesItems.purchasePrice,
      subtotal: salesItems.subtotal,
      isSoLine: salesItems.isSoLine,
      createdAt: salesTransactions.createdAt,
      grandTotal: salesTransactions.grandTotal,
    })
    .from(salesItems)
    .innerJoin(salesTransactions, eq(salesItems.transactionId, salesTransactions.id))
    .where(
      and(
        eq(salesItems.tenantId, tenantId),
        eq(salesTransactions.branchId, branchId),
        inArray(salesTransactions.status, [...DASHBOARD_SALE_STATUSES]),
        gte(salesTransactions.createdAt, last30From),
      ),
    );

  const itemsByTx = new Map<
    string,
    { grandTotal: number; createdAt: Date; items: typeof salesItemRows }
  >();
  for (const item of salesItemRows) {
    const bucket = itemsByTx.get(item.transactionId) ?? {
      grandTotal: item.grandTotal,
      createdAt: item.createdAt,
      items: [],
    };
    bucket.items.push(item);
    itemsByTx.set(item.transactionId, bucket);
  }

  const effectiveRevenueForTx = (txId: string): number => {
    const bucket = itemsByTx.get(txId);
    if (!bucket || bucket.items.length === 0) {
      const tx = txAll.find((t) => t.id === txId);
      return tx?.grandTotal ?? 0;
    }
    const totalSub = bucket.items.reduce((s, i) => s + i.subtotal, 0);
    if (totalSub <= 0) return bucket.grandTotal;
    const effSub = bucket.items.reduce(
      (s, i) =>
        s +
        effectiveItemSubtotal({
          qty: toQtyNumber(i.qty),
          qtyReturned: i.qtyReturned,
          subtotal: i.subtotal,
        }),
      0,
    );
    return Math.round((bucket.grandTotal * effSub) / totalSub);
  };

  const sumRevenue = (arr: typeof txAll) =>
    arr.reduce((s, t) => s + effectiveRevenueForTx(t.id), 0);

  const pnlSource = await loadPnlSource(tenantId, branchId, {
    from: last30Str,
    to: todayStr,
  });

  const todayTx = txAll.filter((t) => txDateKey(t.createdAt) === todayStr);
  const yesterdayTx = txAll.filter((t) => txDateKey(t.createdAt) === yesterdayStr);
  const weekTx = txAll.filter((t) => txDateKey(t.createdAt) >= weekStartStr);
  const monthTx = txAll.filter((t) => txDateKey(t.createdAt) >= monthStartStr);

  const todayGrossPnl = summarizePnlSource(pnlSource, todayStr, todayStr);
  const yesterdayGrossPnl = summarizePnlSource(pnlSource, yesterdayStr, yesterdayStr);
  const weekGrossPnl = summarizePnlSource(pnlSource, weekStartStr, todayStr);
  const monthGrossPnl = summarizePnlSource(pnlSource, monthStartStr, todayStr);

  const todayGrossProfit = todayGrossPnl.grossProfit;
  const todayOpex = todayGrossPnl.opex;
  const yesterdayGrossProfit = yesterdayGrossPnl.grossProfit;
  const yesterdayOpex = yesterdayGrossPnl.opex;
  const weekGrossProfit = weekGrossPnl.grossProfit;
  const weekOpex = weekGrossPnl.opex;
  const monthGrossProfit = monthGrossPnl.grossProfit;
  const monthOpex = monthGrossPnl.opex;

  const [arSummary, apSummary, stockAlerts, chartData, cashAccounts] = await Promise.all([
    getArSummary(tenantId, branchId),
    getApSummary(tenantId, branchId),
    getStockAlertsReport(tenantId, branchId),
    getDailySalesReport(tenantId, branchId, {
      from: last30From.toISOString(),
      to: new Date().toISOString(),
    }),
    listCashAccounts(tenantId, branchId, { activeOnly: true }),
  ]);

  return {
    todayRevenue: sumRevenue(todayTx),
    todayTransactions: todayTx.length,
    todayGrossProfit,
    todayNetProfit: todayGrossProfit - todayOpex,
    todayOpex,
    yesterdayRevenue: sumRevenue(yesterdayTx),
    yesterdayTransactions: yesterdayTx.length,
    yesterdayGrossProfit,
    yesterdayNetProfit: yesterdayGrossProfit - yesterdayOpex,
    weekRevenue: sumRevenue(weekTx),
    weekGrossProfit,
    weekNetProfit: weekGrossProfit - weekOpex,
    monthRevenue: sumRevenue(monthTx),
    monthGrossProfit,
    monthNetProfit: monthGrossProfit - monthOpex,
    monthOpex,
    totalAr: arSummary.total,
    totalAp: apSummary.total,
    overdueAr: arSummary.overdue,
    lowStockCount: stockAlerts.filter((a) => a.stockStatus === "low").length,
    criticalStockCount: stockAlerts.filter((a) => a.stockStatus === "critical").length,
    totalCashBalance: cashAccounts.reduce((s, a) => s + a.balance, 0),
    cashAccountCount: cashAccounts.length,
    revenueChartData: chartData,
  };
}

export async function getDashboardBundleReport(
  tenantId: string,
  branchIds: string[],
): Promise<DashboardBranchBundle[]> {
  if (branchIds.length === 0) return [];

  const todayKey = todayKeyInAppTz();
  const last30FromKey = addDaysToDateKey(todayKey, -29);
  const { from: last30From } = utcRangeForAppDateKey(last30FromKey);
  const { from: todayFrom, to: todayTo } = utcRangeForAppDateKey(todayKey);
  const last30Range = { from: last30From.toISOString(), to: new Date().toISOString() };
  const todayRange = { from: todayFrom.toISOString(), to: todayTo.toISOString() };

  return Promise.all(
    branchIds.map(async (branchId) => {
      const [stats, topProducts30d, topProductsToday] = await Promise.all([
        getDashboardStatsReport(tenantId, branchId),
        getTopProductsReport(tenantId, branchId, last30Range, 10),
        getTopProductsReport(tenantId, branchId, todayRange, 25),
      ]);
      return { branchId, stats, topProducts30d, topProductsToday };
    }),
  );
}

export async function getProfitLossSummaryReport(
  tenantId: string,
  branchId: string,
  dateRange: DateRangeFilter,
): Promise<{
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  opex: number;
  netProfit: number;
  salesMargin: number;
  marginPct: number;
}> {
  const pl = await getUnifiedProfitLoss(tenantId, branchId, dateRange);
  return {
    revenue: pl.sales,
    cogs: pl.cogs,
    grossProfit: pl.grossProfit,
    grossMargin: pl.grossMarginPct,
    opex: pl.opex,
    netProfit: pl.netProfit,
    salesMargin: pl.salesMargin,
    marginPct: pl.marginPct,
  };
}

function reportPeriodToDateRange(periodDays: number): DateRangeFilter {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - periodDays + 1);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatReportDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function buildEmptyReportChart(periodDays: number) {
  const rows: ReportsBundle["salesReport"]["chart"] = [];
  for (let i = 0; i < periodDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (periodDays - 1 - i));
    const date = txDateKey(d);
    rows.push({ date, label: formatReportDayLabel(date), total: 0, transactions: 0 });
  }
  return rows;
}

export async function getCashierAuditReport(
  tenantId: string,
  branchIds: string[],
  dateRange: DateRangeFilter,
): Promise<{ cashiers: CashierAuditRow[]; transactions: CashierTransactionRow[] }> {
  if (branchIds.length === 0) return { cashiers: [], transactions: [] };

  const db = getReadDb();
  const txRows = await db.query.salesTransactions.findMany({
    where: and(
      eq(salesTransactions.tenantId, tenantId),
      inArray(salesTransactions.branchId, branchIds),
      inArray(salesTransactions.status, ["completed", "voided"]),
      gte(salesTransactions.createdAt, new Date(dateRange.from)),
      lte(salesTransactions.createdAt, new Date(dateRange.to)),
    ),
    orderBy: [desc(salesTransactions.createdAt)],
    limit: 200,
  });

  if (txRows.length === 0) return { cashiers: [], transactions: [] };

  const cashierIds = [
    ...new Set(
      txRows.map((t) => t.paidBy ?? t.inputBy).filter((id): id is string => Boolean(id)),
    ),
  ];

  const profileRows =
    cashierIds.length > 0
      ? await db.query.profiles.findMany({
          where: and(
            eq(profiles.tenantId, tenantId),
            inArray(profiles.id, cashierIds),
          ),
        })
      : [];

  const profileMap = new Map(profileRows.map((p) => [p.id, p]));

  type CashierAgg = CashierAuditRow & { _discountFlag: boolean };
  const aggMap = new Map<string, CashierAgg>();

  for (const tx of txRows) {
    const cashierId = tx.paidBy ?? tx.inputBy ?? "unknown";
    const profile = profileMap.get(cashierId);
    const name = profile?.name ?? "Kasir";
    const role = profile?.role ?? "cashier";

    if (!aggMap.has(cashierId)) {
      aggMap.set(cashierId, {
        id: cashierId,
        name,
        role,
        transactions: 0,
        revenue: 0,
        voids: 0,
        excessiveDiscounts: 0,
        _discountFlag: false,
      });
    }

    const agg = aggMap.get(cashierId)!;
    if (tx.status === "completed") {
      agg.transactions += 1;
      agg.revenue += tx.grandTotal;
    } else if (tx.status === "voided") {
      agg.voids += 1;
    }

    if (tx.discountAmount > 0 && tx.subtotal > 0 && tx.discountAmount / tx.subtotal > 0.15) {
      agg._discountFlag = true;
    }
  }

  const cashiers: CashierAuditRow[] = Array.from(aggMap.values())
    .map(({ _discountFlag, ...row }) => ({
      ...row,
      excessiveDiscounts: _discountFlag ? 1 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const transactions: CashierTransactionRow[] = txRows.slice(0, 50).map((tx) => {
    const cashierId = tx.paidBy ?? tx.inputBy;
    const profile = cashierId ? profileMap.get(cashierId) : undefined;
    return {
      id: tx.id,
      invoice: tx.transactionNumber,
      date: tx.createdAt.toISOString(),
      cashier: profile?.name ?? "Kasir",
      total: tx.grandTotal,
      status: tx.status === "voided" ? "void" : "completed",
    };
  });

  return { cashiers, transactions };
}

export async function getReportsBundleReport(
  tenantId: string,
  branchIds: string[],
  periodDays: number,
  monthRange: DateRangeFilter,
): Promise<ReportsBundle> {
  const empty: ReportsBundle = {
    salesReport: {
      chart: buildEmptyReportChart(periodDays),
      summary: { totalSales: 0, totalTransactions: 0, avgTicket: 0 },
    },
    topProducts: [],
    paymentMethods: [],
    profitLoss: {
      sales: 0,
      salesMargin: 0,
      cogs: 0,
      grossProfit: 0,
      opex: 0,
      netProfit: 0,
      marginPct: 0,
      grossMarginPct: 0,
    },
  };

  if (branchIds.length === 0) return empty;

  const dateRange = reportPeriodToDateRange(periodDays);
  const cashierAudit = await getCashierAuditReport(tenantId, branchIds, dateRange);
  const { getOpnameVarianceReport } = await import("@/server/services/transfers");
  const opnameVariance = await getOpnameVarianceReport(tenantId, branchIds, dateRange);
  const dayMap = new Map<string, (typeof empty.salesReport.chart)[number]>();
  for (const row of buildEmptyReportChart(periodDays)) {
    dayMap.set(row.date, { ...row });
  }

  let payCash = 0;
  let payTransfer = 0;
  let payQris = 0;
  let payCredit = 0;
  const productMap = new Map<string, (typeof empty.topProducts)[number]>();
  let plRevenue = 0;
  let plCogs = 0;
  let plGross = 0;
  let plOpex = 0;
  let plNet = 0;

  await Promise.all(
    branchIds.map(async (branchId) => {
      const [daily, top, pl] = await Promise.all([
        getDailySalesReport(tenantId, branchId, dateRange),
        getTopProductsReport(tenantId, branchId, dateRange, 15),
        getProfitLossSummaryReport(tenantId, branchId, monthRange),
      ]);

      for (const day of daily) {
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

      for (const p of top) {
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

      plRevenue += pl.revenue;
      plCogs += pl.cogs;
      plGross += pl.grossProfit;
      plOpex += pl.opex;
      plNet += pl.netProfit;
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
    profitLoss: {
      sales: plRevenue,
      salesMargin: plGross,
      cogs: plCogs,
      grossProfit: plGross,
      opex: plOpex,
      netProfit: plNet,
      marginPct: plRevenue > 0 ? Math.round((plNet / plRevenue) * 100) : 0,
      grossMarginPct: plRevenue > 0 ? Math.round((plGross / plRevenue) * 100) : 0,
    },
    cashierAudit,
    opnameVariance,
  };
}

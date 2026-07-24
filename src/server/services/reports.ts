// =============================================================================
// Reports service — dashboard & laporan aggregations (Phase 5)
// =============================================================================

import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  branchProducts,
  branches,
  cashTransactions,
  products,
  salesItems,
  salesTransactions,
} from "@/server/db/schema";
import { listCashAccounts } from "@/server/services/finance";
import { getApSummary } from "@/server/services/payables";
import { getArSummary } from "@/server/services/receivables";
import type {
  BranchSummary,
  DailySalesSummary,
  DashboardStats,
  DateRangeFilter,
  StockAlertItem,
  StockStatus,
  TopProduct,
} from "@/types/app";

export async function getDailySalesReport(
  tenantId: string,
  branchId: string,
  dateRange: DateRangeFilter,
): Promise<DailySalesSummary[]> {
  const db = getDb();
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
    const date = tx.createdAt.toISOString().split("T")[0];
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

export async function getTopProductsReport(
  tenantId: string,
  branchId: string,
  dateRange: DateRangeFilter,
  limit = 10,
): Promise<TopProduct[]> {
  const db = getDb();
  const fromDate = dateRange.from.split("T")[0];
  const toDate = dateRange.to.split("T")[0];

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
      createdAt: salesTransactions.createdAt,
      branchId: salesTransactions.branchId,
      status: salesTransactions.status,
    })
    .from(salesItems)
    .innerJoin(salesTransactions, eq(salesItems.transactionId, salesTransactions.id))
    .where(eq(salesItems.tenantId, tenantId));

  const productMap = new Map<string, TopProduct>();

  for (const item of rows) {
    if (item.status !== "completed") continue;
    if (item.branchId !== branchId) continue;
    const txDate = item.createdAt.toISOString().split("T")[0];
    if (txDate < fromDate || txDate > toDate) continue;

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
    p.totalQty += item.qty;
    p.totalRevenue += item.subtotal;
    p.totalProfit += (item.sellingPrice - item.purchasePrice) * item.qty;
  }

  return Array.from(productMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

export async function getBranchSummariesReport(
  tenantId: string,
  dateRange: DateRangeFilter,
): Promise<BranchSummary[]> {
  const db = getDb();
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
    if (bSummary && s.stock <= s.reorderPoint) {
      bSummary.stockAlerts += 1;
    }
  }

  return summaries;
}

export async function getStockAlertsReport(
  tenantId: string,
  branchId?: string,
): Promise<StockAlertItem[]> {
  const db = getDb();
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
    if (bp.stock > bp.reorderPoint) continue;
    const p = productMap.get(bp.productId);
    const stockStatus: StockStatus = bp.stock <= bp.reorderPoint * 0.4 ? "critical" : "low";

    alerts.push({
      branchProductId: bp.id,
      productId: bp.productId,
      sku: p?.sku ?? "",
      productName: p?.name ?? "",
      unit: p?.unit ?? "",
      branchId: bp.branchId,
      branchName: branchMap.get(bp.branchId) ?? "",
      stock: bp.stock,
      legacyStock: bp.legacyStock,
      reorderPoint: bp.reorderPoint,
      stockStatus,
    });
  }

  return alerts;
}

function txDateKey(iso: Date | string): string {
  return (typeof iso === "string" ? new Date(iso) : iso).toISOString().split("T")[0]!;
}

function inDateRange(dateKey: string, from: string, to: string): boolean {
  return dateKey >= from && dateKey <= to;
}

function isOpexCategory(category: string): boolean {
  return category !== "HPP" && category !== "Pembelian";
}

export async function getDashboardStatsReport(
  tenantId: string,
  branchId: string,
): Promise<DashboardStats> {
  const today = new Date();
  const todayStr = txDateKey(today);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = txDateKey(yesterday);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const weekStartStr = txDateKey(weekStart);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStartStr = txDateKey(monthStart);

  const last30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last30Str = txDateKey(last30);

  const db = getDb();
  const txAll = await db.query.salesTransactions.findMany({
    where: and(
      eq(salesTransactions.tenantId, tenantId),
      eq(salesTransactions.branchId, branchId),
      eq(salesTransactions.status, "completed"),
      gte(salesTransactions.createdAt, new Date(`${last30Str}T00:00:00.000Z`)),
    ),
  });

  const salesItemRows = await db
    .select({
      qty: salesItems.qty,
      purchasePrice: salesItems.purchasePrice,
      subtotal: salesItems.subtotal,
      createdAt: salesTransactions.createdAt,
    })
    .from(salesItems)
    .innerJoin(salesTransactions, eq(salesItems.transactionId, salesTransactions.id))
    .where(
      and(
        eq(salesItems.tenantId, tenantId),
        eq(salesTransactions.branchId, branchId),
        eq(salesTransactions.status, "completed"),
        gte(salesTransactions.createdAt, new Date(`${last30Str}T00:00:00.000Z`)),
      ),
    );

  const cashTxRows = await db.query.cashTransactions.findMany({
    where: and(
      eq(cashTransactions.tenantId, tenantId),
      eq(cashTransactions.branchId, branchId),
      eq(cashTransactions.type, "expense"),
      gte(cashTransactions.createdAt, new Date(`${last30Str}T00:00:00.000Z`)),
    ),
  });

  const sum = (arr: typeof txAll) => arr.reduce((s, t) => s + t.grandTotal, 0);
  const todayTx = txAll.filter((t) => txDateKey(t.createdAt) === todayStr);
  const yesterdayTx = txAll.filter((t) => txDateKey(t.createdAt) === yesterdayStr);
  const weekTx = txAll.filter((t) => txDateKey(t.createdAt) >= weekStartStr);
  const monthTx = txAll.filter((t) => txDateKey(t.createdAt) >= monthStartStr);

  const grossProfitForRange = (from: string, to: string) => {
    let gross = 0;
    for (const item of salesItemRows) {
      const d = txDateKey(item.createdAt);
      if (!inDateRange(d, from, to)) continue;
      gross += item.subtotal - item.purchasePrice * item.qty;
    }
    return gross;
  };

  const opexForRange = (from: string, to: string) => {
    let opex = 0;
    for (const tx of cashTxRows) {
      const d = txDateKey(tx.createdAt);
      if (!inDateRange(d, from, to)) continue;
      if (!isOpexCategory(tx.category)) continue;
      opex += tx.amount;
    }
    return opex;
  };

  const todayGrossProfit = grossProfitForRange(todayStr, todayStr);
  const todayOpex = opexForRange(todayStr, todayStr);
  const yesterdayGrossProfit = grossProfitForRange(yesterdayStr, yesterdayStr);
  const yesterdayOpex = opexForRange(yesterdayStr, yesterdayStr);
  const weekGrossProfit = grossProfitForRange(weekStartStr, todayStr);
  const weekOpex = opexForRange(weekStartStr, todayStr);
  const monthGrossProfit = grossProfitForRange(monthStartStr, todayStr);
  const monthOpex = opexForRange(monthStartStr, todayStr);

  const [arSummary, apSummary, stockAlerts, chartData, cashAccounts] = await Promise.all([
    getArSummary(tenantId, branchId),
    getApSummary(tenantId, branchId),
    getStockAlertsReport(tenantId, branchId),
    getDailySalesReport(tenantId, branchId, {
      from: `${last30Str}T00:00:00.000Z`,
      to: new Date().toISOString(),
    }),
    listCashAccounts(tenantId, branchId, { activeOnly: true }),
  ]);

  return {
    todayRevenue: sum(todayTx),
    todayTransactions: todayTx.length,
    todayGrossProfit,
    todayNetProfit: todayGrossProfit - todayOpex,
    todayOpex,
    yesterdayRevenue: sum(yesterdayTx),
    yesterdayTransactions: yesterdayTx.length,
    yesterdayGrossProfit,
    yesterdayNetProfit: yesterdayGrossProfit - yesterdayOpex,
    weekRevenue: sum(weekTx),
    weekGrossProfit,
    weekNetProfit: weekGrossProfit - weekOpex,
    monthRevenue: sum(monthTx),
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

export async function getProfitLossSummaryReport(
  tenantId: string,
  branchId: string,
  dateRange: DateRangeFilter,
): Promise<{ revenue: number; cogs: number; grossProfit: number; grossMargin: number }> {
  const db = getDb();
  const fromDate = dateRange.from.split("T")[0];
  const toDate = dateRange.to.split("T")[0];

  const rows = await db
    .select({
      qty: salesItems.qty,
      purchasePrice: salesItems.purchasePrice,
      subtotal: salesItems.subtotal,
      createdAt: salesTransactions.createdAt,
      branchId: salesTransactions.branchId,
      status: salesTransactions.status,
    })
    .from(salesItems)
    .innerJoin(salesTransactions, eq(salesItems.transactionId, salesTransactions.id))
    .where(eq(salesItems.tenantId, tenantId));

  let revenue = 0;
  let cogs = 0;

  for (const item of rows) {
    if (item.status !== "completed") continue;
    if (item.branchId !== branchId) continue;
    const d = item.createdAt.toISOString().split("T")[0];
    if (d < fromDate || d > toDate) continue;

    revenue += item.subtotal;
    cogs += item.purchasePrice * item.qty;
  }

  const grossProfit = revenue - cogs;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return { revenue, cogs, grossProfit, grossMargin: Math.round(grossMargin * 100) / 100 };
}

// =============================================================================
// Reports API — aggregation queries for dashboard & laporan
// =============================================================================

import { db as supabase, ok, fail, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import {
  neonGetBranchSummaries,
  neonGetDailySales,
  neonGetDashboardBundle,
  neonGetDashboardStats,
  neonGetProfitLossSummary,
  neonGetReportsBundle,
  neonGetStockAlerts,
  neonGetTopProducts,
} from "@/lib/api/neon/phase5-fns";
import type {
  ApiResponse,
  DateRangeFilter,
  DailySalesSummary,
  TopProduct,
  BranchSummary,
  DashboardStats,
  DashboardBundle,
  ReportsBundle,
  StockAlertItem,
  StockStatus,
} from "@/types/app";
import { getArSummary } from "./receivables";
import { getApSummary } from "./payables";

export async function getDailySales(
  tenantId: string,
  branchId: string,
  dateRange: DateRangeFilter,
): Promise<ApiResponse<DailySalesSummary[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetDailySales({ data: { tenantId, branchId, dateRange } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  try {
    const { data, error } = await supabase
      .from("sales_transactions")
      .select("created_at, grand_total, payment_method, status")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("status", "completed")
      .gte("created_at", dateRange.from)
      .lte("created_at", dateRange.to)
      .order("created_at");

    if (error) return fail(error);

    const byDate = new Map<string, DailySalesSummary>();

    for (const tx of data ?? []) {
      const date = tx.created_at.split("T")[0];
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
      day.totalRevenue += tx.grand_total;
      day.totalTransactions += 1;

      const pm = tx.payment_method;
      if (pm === "cash") day.cashRevenue += tx.grand_total;
      else if (pm === "transfer") day.transferRevenue += tx.grand_total;
      else if (["qris_edc", "qris_gopay", "qris_ovo", "qris_other"].includes(pm))
        day.qrisRevenue += tx.grand_total;
      else if (pm === "credit") day.creditRevenue += tx.grand_total;
    }

    return ok(Array.from(byDate.values()));
  } catch (err) {
    return fail(err);
  }
}

export async function getTopProducts(
  tenantId: string,
  branchId: string,
  dateRange: DateRangeFilter,
  limit = 10,
): Promise<ApiResponse<TopProduct[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetTopProducts({ data: { tenantId, branchId, dateRange, limit } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  try {
    const { data, error } = await supabase
      .from("sales_items")
      .select(`
        product_id, product_name, sku, unit,
        qty, purchase_price, selling_price, subtotal,
        transaction:transaction_id(created_at, branch_id, status)
      `)
      .eq("tenant_id", tenantId);

    if (error) return fail(error);

    const productMap = new Map<string, TopProduct>();

    for (const item of data ?? []) {
      const tx = item.transaction as { created_at: string; branch_id: string; status: string } | null;
      if (!tx || tx.status !== "completed") continue;
      if (tx.branch_id !== branchId) continue;
      const txDate = tx.created_at.split("T")[0];
      if (txDate < dateRange.from.split("T")[0] || txDate > dateRange.to.split("T")[0]) continue;

      const key = item.product_id ?? item.sku;
      if (!productMap.has(key)) {
        productMap.set(key, {
          productId: item.product_id ?? "",
          productName: item.product_name,
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
      p.totalProfit += (item.selling_price - item.purchase_price) * item.qty;
    }

    const sorted = Array.from(productMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    return ok(sorted);
  } catch (err) {
    return fail(err);
  }
}

export async function getBranchSummaries(
  tenantId: string,
  dateRange: DateRangeFilter,
): Promise<ApiResponse<BranchSummary[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetBranchSummaries({ data: { tenantId, dateRange } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  try {
    const { data: branches, error: branchError } = await supabase
      .from("branches")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (branchError) return fail(branchError);

    const { data: txData, error: txError } = await supabase
      .from("sales_transactions")
      .select("branch_id, grand_total")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .gte("created_at", dateRange.from)
      .lte("created_at", dateRange.to);

    if (txError) return fail(txError);

    type BranchRow = { id: string; name: string };
    type TxRow = { branch_id: string; grand_total: number };
    const summaries: BranchSummary[] = ((branches ?? []) as BranchRow[]).map((branch) => {
      const branchTx = ((txData ?? []) as TxRow[]).filter((t) => t.branch_id === branch.id);
      return {
        branchId: branch.id,
        branchName: branch.name,
        totalRevenue: branchTx.reduce((s, t) => s + t.grand_total, 0),
        totalTransactions: branchTx.length,
        stockAlerts: 0,
      };
    });

    const { data: stockData } = await supabase
      .from("branch_products")
      .select("branch_id, stock, reorder_point")
      .eq("tenant_id", tenantId);

    type StockRow = { branch_id: string; stock: number; reorder_point: number };
    for (const s of (stockData ?? []) as StockRow[]) {
      const bSummary = summaries.find((b) => b.branchId === s.branch_id);
      if (bSummary && s.stock <= s.reorder_point) {
        bSummary.stockAlerts += 1;
      }
    }

    return ok(summaries);
  } catch (err) {
    return fail(err);
  }
}

export async function getStockAlerts(
  tenantId: string,
  branchId?: string,
): Promise<ApiResponse<StockAlertItem[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetStockAlerts({ data: { tenantId, branchId } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  try {
    let q = supabase
      .from("branch_products")
      .select(
        "id, branch_id, product_id, stock, legacy_stock, reorder_point, product:product_id(sku, name, unit), branch:branch_id(name)",
      )
      .eq("tenant_id", tenantId);

    if (branchId) q = q.eq("branch_id", branchId);

    const { data, error } = await q;
    if (error) return fail(error);

    type BpRow = {
      id: string;
      branch_id: string;
      product_id: string;
      stock: number;
      legacy_stock: number;
      reorder_point: number;
      product: { sku: string; name: string; unit: string } | null;
      branch: { name: string } | null;
    };
    const alerts: StockAlertItem[] = ((data ?? []) as BpRow[])
      .filter((bp) => bp.stock <= bp.reorder_point)
      .map((bp) => {
        const p = bp.product;
        const b = bp.branch;
        const stock = bp.stock;
        const legacyStock = bp.legacy_stock;
        const rp = bp.reorder_point;

        let stockStatus: StockStatus = "low";
        if (stock <= rp * 0.4) stockStatus = "critical";

        return {
          branchProductId: bp.id,
          productId: bp.product_id,
          sku: p?.sku ?? "",
          productName: p?.name ?? "",
          unit: p?.unit ?? "",
          branchId: bp.branch_id,
          branchName: b?.name ?? "",
          stock,
          legacyStock,
          reorderPoint: rp,
          stockStatus,
        };
      });

    return ok(alerts);
  } catch (err) {
    return fail(err);
  }
}

export async function getDashboardStats(
  tenantId: string,
  branchId: string,
): Promise<ApiResponse<DashboardStats>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetDashboardStats({ data: { tenantId, branchId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal memuat dashboard");
    return ok(result.data);
  }
  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const last30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: txAll } = await supabase
      .from("sales_transactions")
      .select("created_at, grand_total, payment_method")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("status", "completed")
      .gte("created_at", `${last30.split("T")[0]}T00:00:00.000Z`);

    type TxRow2 = { created_at: string; grand_total: number; payment_method: string };
    const allTx = (txAll ?? []) as TxRow2[];
    const todayTx = allTx.filter((t) => t.created_at.startsWith(todayStr));
    const weekTx = allTx.filter((t) => t.created_at.split("T")[0] >= weekStartStr);
    const monthTx = allTx.filter((t) => t.created_at.split("T")[0] >= monthStart);

    const sum = (arr: TxRow2[]) => arr.reduce((s, t) => s + t.grand_total, 0);

    const [arResult, apResult, stockResult, chartResult] = await Promise.all([
      getArSummary(tenantId, branchId),
      getApSummary(tenantId, branchId),
      getStockAlerts(tenantId, branchId),
      getDailySales(tenantId, branchId, {
        from: `${last30.split("T")[0]}T00:00:00.000Z`,
        to: new Date().toISOString(),
      }),
    ]);

    const alerts = stockResult.data ?? [];

    return ok({
      todayRevenue: sum(todayTx),
      todayTransactions: todayTx.length,
      todayGrossProfit: 0,
      todayNetProfit: 0,
      todayOpex: 0,
      yesterdayRevenue: 0,
      yesterdayTransactions: 0,
      yesterdayGrossProfit: 0,
      yesterdayNetProfit: 0,
      weekRevenue: sum(weekTx),
      weekGrossProfit: 0,
      weekNetProfit: 0,
      monthRevenue: sum(monthTx),
      monthGrossProfit: 0,
      monthNetProfit: 0,
      monthOpex: 0,
      totalAr: arResult.data?.total ?? 0,
      totalAp: apResult.data?.total ?? 0,
      overdueAr: arResult.data?.overdue ?? 0,
      lowStockCount: alerts.filter((a) => a.stockStatus === "low").length,
      criticalStockCount: alerts.filter((a) => a.stockStatus === "critical").length,
      totalCashBalance: 0,
      cashAccountCount: 0,
      revenueChartData: chartResult.data ?? [],
    });
  } catch (err) {
    return fail(err);
  }
}

export async function getDashboardBundle(
  tenantId: string,
  branchIds: string[],
): Promise<ApiResponse<DashboardBundle>> {
  if (branchIds.length === 0) return ok({ branches: [] });

  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetDashboardBundle({ data: { tenantId, branchIds } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? { branches: [] });
  }

  try {
    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();
    const todayKey = new Date().toISOString().split("T")[0]!;
    const todayRange = { from: `${todayKey}T00:00:00.000Z`, to };
    const last30Range = { from: last30, to };

    const branches = await Promise.all(
      branchIds.map(async (branchId) => {
        const [statsResult, top30Result, topTodayResult] = await Promise.all([
          getDashboardStats(tenantId, branchId),
          getTopProducts(tenantId, branchId, last30Range, 10),
          getTopProducts(tenantId, branchId, todayRange, 25),
        ]);
        if (statsResult.error || !statsResult.data) {
          throw new Error(statsResult.error ?? "Gagal memuat dashboard");
        }
        return {
          branchId,
          stats: statsResult.data,
          topProducts30d: top30Result.data ?? [],
          topProductsToday: topTodayResult.data ?? [],
        };
      }),
    );

    return ok({ branches });
  } catch (err) {
    return fail(err);
  }
}

export async function getReportsBundle(
  tenantId: string,
  branchIds: string[],
  periodDays: number,
  monthRange: DateRangeFilter,
): Promise<ApiResponse<ReportsBundle>> {
  if (branchIds.length === 0) {
    return ok({
      salesReport: {
        chart: [],
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
    });
  }

  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetReportsBundle({ data: { tenantId, branchIds, periodDays, monthRange } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal memuat laporan");
    return ok(result.data);
  }

  try {
    const dateRange = {
      from: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    };
    const dayMap = new Map<
      string,
      { date: string; label: string; total: number; transactions: number }
    >();
    for (let i = 0; i < periodDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (periodDays - 1 - i));
      const date = d.toISOString().split("T")[0]!;
      dayMap.set(date, {
        date,
        label: new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        total: 0,
        transactions: 0,
      });
    }

    let payCash = 0;
    let payTransfer = 0;
    let payQris = 0;
    let payCredit = 0;
    const productMap = new Map<string, ReportsBundle["topProducts"][number]>();
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

    return ok({
      salesReport: {
        chart,
        summary: {
          totalSales,
          totalTransactions,
          avgTicket: totalTransactions > 0 ? Math.round(totalSales / totalTransactions) : 0,
        },
      },
      topProducts: Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      paymentMethods:
        payTotal > 0
          ? [
              { name: "Tunai", value: Math.round((payCash / payTotal) * 100) },
              { name: "Transfer", value: Math.round((payTransfer / payTotal) * 100) },
              { name: "QRIS", value: Math.round((payQris / payTotal) * 100) },
              { name: "Piutang", value: Math.round((payCredit / payTotal) * 100) },
            ].filter((x) => x.value > 0)
          : [],
      profitLoss: {
        sales: plRevenue,
        salesMargin: plGross,
        cogs: plCogs,
        grossProfit: plGross,
        opex: 0,
        netProfit: plGross,
        marginPct: plRevenue > 0 ? Math.round((plGross / plRevenue) * 100) : 0,
        grossMarginPct: plRevenue > 0 ? Math.round((plGross / plRevenue) * 100) : 0,
      },
    });
  } catch (err) {
    return fail(err);
  }
}

export async function getProfitLossSummary(
  tenantId: string,
  branchId: string,
  dateRange: DateRangeFilter,
): Promise<ApiResponse<{ revenue: number; cogs: number; grossProfit: number; grossMargin: number }>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetProfitLossSummary({ data: { tenantId, branchId, dateRange } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal memuat laporan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("sales_items")
      .select(
        "qty, purchase_price, selling_price, subtotal, transaction:transaction_id(branch_id, status, created_at)",
      )
      .eq("tenant_id", tenantId);

    if (error) return fail(error);

    let revenue = 0;
    let cogs = 0;

    for (const item of data ?? []) {
      const tx = item.transaction as { branch_id: string; status: string; created_at: string } | null;
      if (!tx || tx.status !== "completed") continue;
      if (tx.branch_id !== branchId) continue;
      const d = tx.created_at.split("T")[0];
      if (d < dateRange.from.split("T")[0] || d > dateRange.to.split("T")[0]) continue;

      revenue += item.subtotal;
      cogs += item.purchase_price * item.qty;
    }

    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    return ok({ revenue, cogs, grossProfit, grossMargin: Math.round(grossMargin * 100) / 100 });
  } catch (err) {
    return fail(err);
  }
}

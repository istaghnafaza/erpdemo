// =============================================================================
// Cashflow Intelligence — kas vs laba, forecast 30 hari, cash-lock stok (on-read)
// =============================================================================

import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getReadDb } from "@/server/db";
import { ensureCashflowSchema } from "@/server/db/ensure-cashflow-schema";
import {
  accountsPayable,
  accountsReceivable,
  branchProducts,
  cashTransactions,
  productCategories,
  products,
  stockMovements,
} from "@/server/db/schema";
import { getUnifiedProfitLossForBranches } from "@/server/services/pnl";
import { listCashAccounts } from "@/server/services/finance";
import { POS_SALE_CATEGORY } from "@/lib/cashflow-constants";
import { getMonthDateRange } from "@/lib/finance-calculations";
import {
  addDaysToDateKey,
  todayKeyInAppTz,
  utcRangeForAppDateKey,
} from "@/lib/app-timezone";

import type {
  CashForecastReport,
  CashLockBucket,
  CashLockReport,
  CashVsAccrualReport,
  CashflowDashboardKpis,
  CashLockRow,
  ForecastDay,
  OpenReceivableRow,
} from "@/lib/cashflow-types";

export type {
  CashForecastReport,
  CashLockReport,
  CashVsAccrualReport,
  CashflowDashboardKpis,
  CashLockRow,
  ForecastDay,
  OpenReceivableRow,
};

function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00+07:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export async function getCashVsAccrual(
  tenantId: string,
  branchIds: string[],
  dateRange?: { from: string; to: string },
): Promise<CashVsAccrualReport> {
  await ensureCashflowSchema();
  const range = dateRange ?? getMonthDateRange();
  const db = getReadDb();

  const [accountsByBranch, labaAkuntansi, openRows] = await Promise.all([
    Promise.all(branchIds.map((id) => listCashAccounts(tenantId, id, { activeOnly: true }))),
    getUnifiedProfitLossForBranches(tenantId, branchIds, range),
    branchIds.length === 0
      ? Promise.resolve([])
      : db.query.accountsReceivable.findMany({
          where: and(
            eq(accountsReceivable.tenantId, tenantId),
            inArray(accountsReceivable.branchId, branchIds),
            inArray(accountsReceivable.status, ["unpaid", "partial", "overdue"]),
          ),
          orderBy: accountsReceivable.dueDate,
        }),
  ]);

  const kasRiil = accountsByBranch.flat().reduce((s, a) => s + a.balance, 0);
  const openReceivables: OpenReceivableRow[] = openRows
    .map((r) => ({
      id: r.id,
      branchId: r.branchId,
      invoiceNumber: r.invoiceNumber,
      customerName: r.customerName,
      remainingAmount: r.totalAmount - r.paidAmount,
      dueDate: typeof r.dueDate === "string" ? r.dueDate.slice(0, 10) : String(r.dueDate).slice(0, 10),
      status: r.status,
    }))
    .filter((r) => r.remainingAmount > 0);

  return {
    kasRiil,
    labaAkuntansi,
    openArTotal: openReceivables.reduce((s, r) => s + r.remainingAmount, 0),
    openReceivables,
  };
}

export async function getCashForecast(
  tenantId: string,
  branchIds: string[],
  horizonDays = 30,
): Promise<CashForecastReport> {
  await ensureCashflowSchema();
  const db = getReadDb();
  const today = todayKeyInAppTz();
  const endKey = addDaysToDateKey(today, horizonDays - 1);
  const histFrom = addDaysToDateKey(today, -60);
  const histTo = addDaysToDateKey(today, -31);

  const accounts = (
    await Promise.all(branchIds.map((id) => listCashAccounts(tenantId, id, { activeOnly: true })))
  ).flat();
  const startingBalance = accounts.reduce((s, a) => s + a.balance, 0);

  let avgDailyPosIn = 0;
  if (branchIds.length > 0) {
    const histBounds = {
      from: utcRangeForAppDateKey(histFrom).from,
      to: utcRangeForAppDateKey(histTo).to,
    };
    const posRows = await db
      .select({
        amount: sql<number>`coalesce(sum(${cashTransactions.amount}), 0)::bigint`,
      })
      .from(cashTransactions)
      .where(
        and(
          eq(cashTransactions.tenantId, tenantId),
          inArray(cashTransactions.branchId, branchIds),
          eq(cashTransactions.type, "income"),
          eq(cashTransactions.category, POS_SALE_CATEGORY),
          gte(cashTransactions.createdAt, histBounds.from),
          lte(cashTransactions.createdAt, histBounds.to),
        ),
      );
    const total = Number(posRows[0]?.amount ?? 0);
    avgDailyPosIn = Math.round(total / 30);
  }

  const arRows =
    branchIds.length === 0
      ? []
      : await db.query.accountsReceivable.findMany({
          where: and(
            eq(accountsReceivable.tenantId, tenantId),
            inArray(accountsReceivable.branchId, branchIds),
            inArray(accountsReceivable.status, ["unpaid", "partial", "overdue"]),
          ),
        });
  const apRows =
    branchIds.length === 0
      ? []
      : await db.query.accountsPayable.findMany({
          where: and(
            eq(accountsPayable.tenantId, tenantId),
            inArray(accountsPayable.branchId, branchIds),
            inArray(accountsPayable.status, ["unpaid", "partial", "overdue"]),
          ),
        });

  const arByDay = new Map<string, number>();
  for (const r of arRows) {
    const remaining = r.totalAmount - r.paidAmount;
    if (remaining <= 0) continue;
    const due =
      typeof r.dueDate === "string" ? r.dueDate.slice(0, 10) : String(r.dueDate).slice(0, 10);
    const key = due < today ? today : due;
    arByDay.set(key, (arByDay.get(key) ?? 0) + remaining);
  }
  const apByDay = new Map<string, number>();
  for (const r of apRows) {
    const remaining = r.totalAmount - r.paidAmount;
    if (remaining <= 0) continue;
    const due =
      typeof r.dueDate === "string" ? r.dueDate.slice(0, 10) : String(r.dueDate).slice(0, 10);
    const key = due < today ? today : due;
    apByDay.set(key, (apByDay.get(key) ?? 0) + remaining);
  }

  const days: ForecastDay[] = [];
  let balance = startingBalance;
  let minBalance = startingBalance;
  let firstNegativeDate: string | null = null;

  for (let i = 0; i < horizonDays; i++) {
    const date = addDaysToDateKey(today, i);
    const arDue = arByDay.get(date) ?? 0;
    const apDue = apByDay.get(date) ?? 0;
    balance = balance + arDue + avgDailyPosIn - apDue;
    if (balance < minBalance) minBalance = balance;
    if (balance < 0 && !firstNegativeDate) firstNegativeDate = date;
    days.push({
      date,
      label: formatDayLabel(date),
      arDue,
      apDue,
      avgPosIn: avgDailyPosIn,
      projectedBalance: balance,
    });
  }

  return {
    startingBalance,
    avgDailyPosIn,
    days,
    minBalance,
    endBalance: balance,
    goesNegative: firstNegativeDate != null,
    firstNegativeDate,
  };
}

function toStockNumber(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getInventoryCashLock(
  tenantId: string,
  branchIds: string[],
  categoryId?: string,
): Promise<CashLockReport> {
  await ensureCashflowSchema();
  const db = getReadDb();
  if (branchIds.length === 0) {
    return { rows: [], fastValue: 0, slowValue: 0, deadValue: 0, totalLocked: 0 };
  }

  const stockRows = await db
    .select({
      productId: products.id,
      sku: products.sku,
      name: products.name,
      categoryId: products.categoryId,
      categoryName: productCategories.name,
      purchasePrice: products.purchasePrice,
      stock: branchProducts.stock,
      branchId: branchProducts.branchId,
    })
    .from(branchProducts)
    .innerJoin(products, eq(branchProducts.productId, products.id))
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(
      and(
        eq(branchProducts.tenantId, tenantId),
        inArray(branchProducts.branchId, branchIds),
        ...(categoryId ? [eq(products.categoryId, categoryId)] : []),
      ),
    );

  const byProduct = new Map<
    string,
    {
      sku: string;
      name: string;
      categoryName: string | null;
      unitCost: number;
      stock: number;
    }
  >();
  for (const row of stockRows) {
    const stock = toStockNumber(row.stock);
    if (stock <= 0) continue;
    const prev = byProduct.get(row.productId);
    if (prev) {
      prev.stock += stock;
    } else {
      byProduct.set(row.productId, {
        sku: row.sku,
        name: row.name,
        categoryName: row.categoryName,
        unitCost: row.purchasePrice,
        stock,
      });
    }
  }

  const productIds = [...byProduct.keys()];
  const lastOut = new Map<string, Date>();
  if (productIds.length > 0) {
    const movementRows = await db
      .select({
        productId: stockMovements.productId,
        createdAt: sql<Date>`max(${stockMovements.createdAt})`,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.tenantId, tenantId),
          inArray(stockMovements.branchId, branchIds),
          inArray(stockMovements.productId, productIds),
          inArray(stockMovements.type, ["out", "transfer_out"]),
        ),
      )
      .groupBy(stockMovements.productId);
    for (const m of movementRows) {
      lastOut.set(m.productId, m.createdAt);
    }
  }

  const today = new Date();
  const rows: CashLockRow[] = [];
  let fastValue = 0;
  let slowValue = 0;
  let deadValue = 0;

  for (const [productId, p] of byProduct) {
    const last = lastOut.get(productId);
    const daysSinceOutbound = last
      ? Math.floor((today.getTime() - last.getTime()) / (24 * 60 * 60 * 1000))
      : null;
    let bucket: CashLockBucket;
    if (daysSinceOutbound == null || daysSinceOutbound > 90) bucket = "dead";
    else if (daysSinceOutbound >= 30) bucket = "slow";
    else bucket = "fast";

    const lockedValue = Math.round(p.stock * p.unitCost);
    if (bucket === "fast") fastValue += lockedValue;
    else if (bucket === "slow") slowValue += lockedValue;
    else deadValue += lockedValue;

    rows.push({
      productId,
      sku: p.sku,
      name: p.name,
      categoryName: p.categoryName,
      stock: p.stock,
      unitCost: p.unitCost,
      lockedValue,
      daysSinceOutbound,
      bucket,
      flag: bucket === "dead" ? "stop_reorder" : bucket === "slow" ? "kandidat_diskon" : null,
    });
  }

  rows.sort((a, b) => b.lockedValue - a.lockedValue);
  return {
    rows,
    fastValue,
    slowValue,
    deadValue,
    totalLocked: fastValue + slowValue + deadValue,
  };
}

export async function getCashflowDashboardKpis(
  tenantId: string,
  branchIds: string[],
): Promise<CashflowDashboardKpis> {
  const today = todayKeyInAppTz();
  const in30 = addDaysToDateKey(today, 29);

  const [cashVs, forecast, lock, arAp] = await Promise.all([
    getCashVsAccrual(tenantId, branchIds),
    getCashForecast(tenantId, branchIds, 30),
    getInventoryCashLock(tenantId, branchIds),
    (async () => {
      const db = getReadDb();
      if (branchIds.length === 0) return { arDue30: 0, apDue30: 0 };
      const [ars, aps] = await Promise.all([
        db.query.accountsReceivable.findMany({
          where: and(
            eq(accountsReceivable.tenantId, tenantId),
            inArray(accountsReceivable.branchId, branchIds),
            inArray(accountsReceivable.status, ["unpaid", "partial", "overdue"]),
          ),
        }),
        db.query.accountsPayable.findMany({
          where: and(
            eq(accountsPayable.tenantId, tenantId),
            inArray(accountsPayable.branchId, branchIds),
            inArray(accountsPayable.status, ["unpaid", "partial", "overdue"]),
          ),
        }),
      ]);
      const inWindow = (due: string) => due <= in30;
      const arDue30 = ars.reduce((s, r) => {
        const due = typeof r.dueDate === "string" ? r.dueDate.slice(0, 10) : String(r.dueDate).slice(0, 10);
        const rem = r.totalAmount - r.paidAmount;
        return rem > 0 && inWindow(due) ? s + rem : s;
      }, 0);
      const apDue30 = aps.reduce((s, r) => {
        const due = typeof r.dueDate === "string" ? r.dueDate.slice(0, 10) : String(r.dueDate).slice(0, 10);
        const rem = r.totalAmount - r.paidAmount;
        return rem > 0 && inWindow(due) ? s + rem : s;
      }, 0);
      return { arDue30, apDue30 };
    })(),
  ]);

  return {
    kasRiil: cashVs.kasRiil,
    labaNet: cashVs.labaAkuntansi.netProfit,
    openArTotal: cashVs.openArTotal,
    forecastEnd30: forecast.endBalance,
    forecastGoesNegative: forecast.goesNegative,
    firstNegativeDate: forecast.firstNegativeDate,
    deadStockValue: lock.deadValue,
    slowStockValue: lock.slowValue,
    arDue30: arAp.arDue30,
    apDue30: arAp.apDue30,
  };
}

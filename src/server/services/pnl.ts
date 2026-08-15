// =============================================================================
// Unified P&L — one engine for dashboard, /finance, and /reports/profit-loss.
// Revenue/margin from sales (SO deferred until fulfillment) + opex from cash book.
// =============================================================================

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getReadDb } from "@/server/db";
import { ensureCashflowSchema } from "@/server/db/ensure-cashflow-schema";
import {
  cashTransactions,
  salesItems,
  salesOrderItems,
  salesOrders,
  salesTransactions,
  soFulfillments,
} from "@/server/db/schema";
import {
  computeItemMargin,
  effectiveRecognizedSubtotal,
  toQtyNumber,
} from "@/lib/sales-margin";
import { isPnlOpexCategory } from "@/lib/cashflow-constants";
import type { ProfitLossSummary } from "@/lib/finance-calculations";
import {
  dateKeyInAppTz,
  utcRangeForAppDateKey,
} from "@/lib/app-timezone";
import type { DateRangeFilter } from "@/types/app";

const SALE_STATUSES = ["completed", "returned"] as const;

function toDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return dateKeyInAppTz(value);
}

function utcBounds(from: string, to: string): { from: Date; to: Date } {
  return {
    from: utcRangeForAppDateKey(toDateKey(from)).from,
    to: utcRangeForAppDateKey(toDateKey(to)).to,
  };
}

function emptyPnl(): ProfitLossSummary {
  return {
    sales: 0,
    salesMargin: 0,
    cogs: 0,
    grossProfit: 0,
    opex: 0,
    netProfit: 0,
    marginPct: 0,
    grossMarginPct: 0,
  };
}

function finalizePnl(sales: number, salesMargin: number, opex: number): ProfitLossSummary {
  const grossProfit = salesMargin;
  const cogs = Math.max(0, sales - salesMargin);
  const netProfit = grossProfit - opex;
  const marginPct = sales > 0 ? Math.round((netProfit / sales) * 100) : 0;
  const grossMarginPct = sales > 0 ? Math.round((salesMargin / sales) * 100) : 0;
  return { sales, salesMargin, cogs, grossProfit, opex, netProfit, marginPct, grossMarginPct };
}

interface SaleItemRow {
  createdAt: Date;
  qty: number;
  qtyReturned: number;
  purchasePrice: number;
  subtotal: number;
  isSoLine: boolean;
  grandTotal: number;
  transactionId: string;
}

interface FulfillmentRow {
  createdAt: Date;
  qty: number;
  purchasePriceAtTime: number;
  itemQty: number;
  itemSubtotal: number;
}

interface ExpenseRow {
  createdAt: Date;
  type: "income" | "expense" | "transfer";
  category: string;
  amount: number;
}

export interface PnlSourceRows {
  items: SaleItemRow[];
  fulfillments: FulfillmentRow[];
  expenses: ExpenseRow[];
}

export async function loadPnlSource(
  tenantId: string,
  branchId: string,
  dateRange: DateRangeFilter,
): Promise<PnlSourceRows> {
  await ensureCashflowSchema();
  const db = getReadDb();
  const bounds = utcBounds(dateRange.from, dateRange.to);

  const [items, fulfillments, expenses] = await Promise.all([
    db
      .select({
        createdAt: salesTransactions.createdAt,
        qty: salesItems.qty,
        qtyReturned: salesItems.qtyReturned,
        purchasePrice: salesItems.purchasePrice,
        subtotal: salesItems.subtotal,
        isSoLine: salesItems.isSoLine,
        grandTotal: salesTransactions.grandTotal,
        transactionId: salesItems.transactionId,
      })
      .from(salesItems)
      .innerJoin(salesTransactions, eq(salesItems.transactionId, salesTransactions.id))
      .where(
        and(
          eq(salesItems.tenantId, tenantId),
          eq(salesTransactions.branchId, branchId),
          inArray(salesTransactions.status, [...SALE_STATUSES]),
          gte(salesTransactions.createdAt, bounds.from),
          lte(salesTransactions.createdAt, bounds.to),
        ),
      ),
    db
      .select({
        createdAt: soFulfillments.createdAt,
        qty: soFulfillments.qty,
        purchasePriceAtTime: soFulfillments.purchasePriceAtTime,
        itemQty: salesOrderItems.qty,
        itemSubtotal: salesOrderItems.subtotal,
      })
      .from(soFulfillments)
      .innerJoin(salesOrderItems, eq(soFulfillments.soItemId, salesOrderItems.id))
      .innerJoin(salesOrders, eq(salesOrderItems.soId, salesOrders.id))
      .where(
        and(
          eq(soFulfillments.tenantId, tenantId),
          eq(salesOrders.branchId, branchId),
          eq(soFulfillments.status, "delivered"),
          gte(soFulfillments.createdAt, bounds.from),
          lte(soFulfillments.createdAt, bounds.to),
        ),
      ),
    db
      .select({
        createdAt: cashTransactions.createdAt,
        type: cashTransactions.type,
        category: cashTransactions.category,
        amount: cashTransactions.amount,
      })
      .from(cashTransactions)
      .where(
        and(
          eq(cashTransactions.tenantId, tenantId),
          eq(cashTransactions.branchId, branchId),
          eq(cashTransactions.type, "expense"),
          gte(cashTransactions.createdAt, bounds.from),
          lte(cashTransactions.createdAt, bounds.to),
        ),
      ),
  ]);

  return {
    items: items.map((i) => ({ ...i, qty: toQtyNumber(i.qty) })),
    fulfillments: fulfillments.map((f) => ({
      ...f,
      qty: toQtyNumber(f.qty),
      itemQty: toQtyNumber(f.itemQty),
    })),
    expenses,
  };
}

export function summarizePnlSource(
  source: PnlSourceRows,
  fromKey: string,
  toKey: string,
): ProfitLossSummary {
  let sales = 0;
  let salesMargin = 0;

  const txRevenue = new Map<string, { grandTotal: number; totalSub: number; recognizedSub: number }>();
  for (const item of source.items) {
    const d = dateKeyInAppTz(item.createdAt);
    if (d < fromKey || d > toKey) continue;
    const bucket = txRevenue.get(item.transactionId) ?? {
      grandTotal: item.grandTotal,
      totalSub: 0,
      recognizedSub: 0,
    };
    bucket.totalSub += item.subtotal;
    bucket.recognizedSub += effectiveRecognizedSubtotal(item);
    txRevenue.set(item.transactionId, bucket);

    salesMargin += computeItemMargin(item);
  }
  for (const bucket of txRevenue.values()) {
    if (bucket.totalSub <= 0) {
      sales += bucket.grandTotal;
      continue;
    }
    sales += Math.round((bucket.grandTotal * bucket.recognizedSub) / bucket.totalSub);
  }

  for (const f of source.fulfillments) {
    const d = dateKeyInAppTz(f.createdAt);
    if (d < fromKey || d > toKey) continue;
    const unit = f.itemQty > 0 ? f.itemSubtotal / f.itemQty : 0;
    const revenue = Math.round(unit * f.qty);
    const cogs = f.purchasePriceAtTime * f.qty;
    sales += revenue;
    salesMargin += revenue - cogs;
  }

  let opex = 0;
  for (const tx of source.expenses) {
    const d = dateKeyInAppTz(tx.createdAt);
    if (d < fromKey || d > toKey) continue;
    if (!isPnlOpexCategory(tx.category, tx.type)) continue;
    opex += tx.amount;
  }

  return finalizePnl(sales, salesMargin, opex);
}

export async function getUnifiedProfitLoss(
  tenantId: string,
  branchId: string,
  dateRange: DateRangeFilter,
): Promise<ProfitLossSummary> {
  const fromKey = toDateKey(dateRange.from);
  const toKey = toDateKey(dateRange.to);
  const source = await loadPnlSource(tenantId, branchId, dateRange);
  return summarizePnlSource(source, fromKey, toKey);
}

export async function getUnifiedProfitLossForBranches(
  tenantId: string,
  branchIds: string[],
  dateRange: DateRangeFilter,
): Promise<ProfitLossSummary> {
  if (branchIds.length === 0) return emptyPnl();
  const parts = await Promise.all(
    branchIds.map((id) => getUnifiedProfitLoss(tenantId, id, dateRange)),
  );
  return parts.reduce((acc, pl) => {
    const sales = acc.sales + pl.sales;
    const salesMargin = acc.salesMargin + pl.salesMargin;
    const opex = acc.opex + pl.opex;
    return finalizePnl(sales, salesMargin, opex);
  }, emptyPnl());
}

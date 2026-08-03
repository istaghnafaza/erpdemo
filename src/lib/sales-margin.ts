// =============================================================================
// Sales margin — keuntungan per transaksi / agregasi dari item penjualan.
// =============================================================================

import type { SalesTransactionRecord } from "@/types/sales-transactions";
import type { TopProduct } from "@/types/app";

type MarginItem = {
  qty: number;
  qtyReturned?: number;
  subtotal: number;
  purchasePrice: number;
  isSoLine?: boolean;
};

/** Qty efektif setelah retur — dipakai dashboard & histori penjualan. */
export function effectiveItemQty(item: Pick<MarginItem, "qty" | "qtyReturned">): number {
  return Math.max(0, item.qty - (item.qtyReturned ?? 0));
}

/** Subtotal proporsional untuk baris yang sebagian/seluruhnya diretur. */
export function effectiveItemSubtotal(item: Pick<MarginItem, "qty" | "qtyReturned" | "subtotal">): number {
  if (item.qty <= 0) return 0;
  const eq = effectiveItemQty(item);
  if (eq <= 0) return 0;
  return Math.round((item.subtotal * eq) / item.qty);
}

/** Margin satu baris (abaikan SO). */
export function computeItemMargin(item: MarginItem): number {
  if (item.isSoLine) return 0;
  const eq = effectiveItemQty(item);
  if (eq <= 0 || item.qty <= 0) return 0;
  const unitMargin = (item.subtotal - item.purchasePrice * item.qty) / item.qty;
  return Math.round(unitMargin * eq);
}

/** Omzet efektif transaksi setelah retur (grandTotal × rasio subtotal efektif). */
export function computeTransactionRevenue(tx: SalesTransactionRecord): number {
  if (tx.status !== "completed" && tx.status !== "returned") return 0;
  if (tx.items.length === 0) return tx.grandTotal;
  const totalSub = tx.items.reduce((s, i) => s + i.subtotal, 0);
  if (totalSub <= 0) return tx.grandTotal;
  const effSub = tx.items.reduce((s, i) => s + effectiveItemSubtotal(i), 0);
  return Math.round((tx.grandTotal * effSub) / totalSub);
}

export function computeTransactionMargin(tx: SalesTransactionRecord): number {
  if (tx.status !== "completed" && tx.status !== "returned") return 0;
  return tx.items.reduce((sum, item) => sum + computeItemMargin(item), 0);
}

export function computeTransactionsMarginSummary(transactions: SalesTransactionRecord[]): {
  totalRevenue: number;
  totalMargin: number;
  marginPct: number;
} {
  const completed = transactions.filter((t) => t.status === "completed" || t.status === "returned");
  const totalRevenue = completed.reduce((s, t) => s + computeTransactionRevenue(t), 0);
  const totalMargin = completed.reduce((s, t) => s + computeTransactionMargin(t), 0);
  const marginPct = totalRevenue > 0 ? Math.round((totalMargin / totalRevenue) * 100) : 0;
  return { totalRevenue, totalMargin, marginPct };
}

export interface TopProfitableProductRow {
  sku: string;
  name: string;
  profit: number;
  qty: number;
}

export function mergeTopProductsByProfit(items: TopProduct[], limit = 5): TopProfitableProductRow[] {
  const byKey = new Map<string, TopProfitableProductRow>();
  for (const item of items) {
    const key = item.productId || item.sku;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        sku: item.sku,
        name: item.productName,
        profit: item.totalProfit,
        qty: item.totalQty,
      });
      continue;
    }
    existing.profit += item.totalProfit;
    existing.qty += item.totalQty;
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.profit - a.profit)
    .slice(0, limit);
}

export function topProfitableFromSalesRecords(
  sales: SalesTransactionRecord[],
  options?: { from?: string; to?: string },
): TopProfitableProductRow[] {
  const bySku = new Map<string, TopProfitableProductRow>();

  for (const sale of sales) {
    if (sale.status !== "completed" && sale.status !== "returned") continue;
    const d = sale.createdAt.split("T")[0]!;
    if (options?.from && d < options.from) continue;
    if (options?.to && d > options.to) continue;

    for (const item of sale.items) {
      if (item.isSoLine) continue;
      const profit = computeItemMargin(item);
      const prev = bySku.get(item.sku);
      if (!prev) {
        bySku.set(item.sku, {
          sku: item.sku,
          name: item.productName,
          profit,
          qty: item.qty,
        });
      } else {
        prev.profit += profit;
        prev.qty += item.qty;
      }
    }
  }

  return Array.from(bySku.values())
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);
}

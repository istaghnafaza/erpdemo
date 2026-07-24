// =============================================================================
// Sales margin — keuntungan per transaksi / agregasi dari item penjualan.
// =============================================================================

import type { SalesTransactionRecord } from "@/types/sales-transactions";
import type { TopProduct } from "@/types/app";

export function computeTransactionMargin(tx: SalesTransactionRecord): number {
  if (tx.status !== "completed") return 0;
  return tx.items.reduce((sum, item) => {
    if (item.isSoLine) return sum;
    return sum + (item.subtotal - item.purchasePrice * item.qty);
  }, 0);
}

export function computeTransactionsMarginSummary(transactions: SalesTransactionRecord[]): {
  totalRevenue: number;
  totalMargin: number;
  marginPct: number;
} {
  const completed = transactions.filter((t) => t.status === "completed");
  const totalRevenue = completed.reduce((s, t) => s + t.grandTotal, 0);
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
    if (sale.status !== "completed") continue;
    const d = sale.createdAt.split("T")[0]!;
    if (options?.from && d < options.from) continue;
    if (options?.to && d > options.to) continue;

    for (const item of sale.items) {
      if (item.isSoLine) continue;
      const profit = item.subtotal - item.purchasePrice * item.qty;
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

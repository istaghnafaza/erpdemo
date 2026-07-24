// =============================================================================
// Finance calculations — P&L & cash flow dari transaksi kas + histori POS.
// =============================================================================

import type { CashTransaction } from "@/types/database";
import type { SalesTransactionRecord } from "@/types/sales-transactions";

export interface ProfitLossSummary {
  sales: number;
  /** Total margin keuntungan — selisih harga jual vs beli per baris penjualan. */
  salesMargin: number;
  /** Sisa internal (penjualan − margin); tidak ditampilkan sebagai HPP. */
  cogs: number;
  grossProfit: number;
  opex: number;
  netProfit: number;
  marginPct: number;
  /** Persentase margin keuntungan terhadap penjualan. */
  grossMarginPct: number;
}

export interface CashFlowDay {
  date: string;
  label: string;
  inflow: number;
  outflow: number;
}

function localDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inPeriod(iso: string, from?: string, to?: string): boolean {
  const d = localDateKey(iso);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function computeSalesAndMarginFromPos(
  salesRecords: SalesTransactionRecord[],
  options?: { from?: string; to?: string },
): { sales: number; salesMargin: number } {
  let sales = 0;
  let salesMargin = 0;

  for (const sale of salesRecords) {
    if (sale.status !== "completed") continue;
    if (!inPeriod(sale.createdAt, options?.from, options?.to)) continue;

    sales += sale.grandTotal;
    for (const item of sale.items) {
      if (item.isSoLine) continue;
      salesMargin += item.subtotal - item.purchasePrice * item.qty;
    }
  }

  return { sales, salesMargin };
}

function computeSalesAndMarginFromLedger(
  transactions: CashTransaction[],
  options?: { from?: string; to?: string },
): { sales: number; salesMargin: number } {
  let sales = 0;
  let cost = 0;

  for (const tx of transactions) {
    if (!inPeriod(tx.created_at, options?.from, options?.to)) continue;
    if (tx.type === "transfer") continue;

    if (tx.type === "income" && tx.category === "Penjualan") {
      sales += tx.amount;
    } else if (tx.type === "expense") {
      if (tx.category === "Pembelian" || tx.category === "HPP") cost += tx.amount;
    }
  }

  return { sales, salesMargin: sales - cost };
}

export function computeProfitLoss(
  transactions: CashTransaction[],
  options?: { from?: string; to?: string },
  salesRecords?: SalesTransactionRecord[],
): ProfitLossSummary {
  const fromPos =
    salesRecords !== undefined
      ? computeSalesAndMarginFromPos(salesRecords, options)
      : computeSalesAndMarginFromLedger(transactions, options);

  let opex = 0;
  for (const tx of transactions) {
    if (!inPeriod(tx.created_at, options?.from, options?.to)) continue;
    if (tx.type === "transfer") continue;
    if (tx.type === "expense") {
      if (tx.category === "HPP" || tx.category === "Pembelian") continue;
      opex += tx.amount;
    }
  }

  const { sales, salesMargin } = fromPos;
  const grossProfit = salesMargin;
  const cogs = Math.max(0, sales - salesMargin);
  const netProfit = grossProfit - opex;
  const marginPct = sales > 0 ? Math.round((netProfit / sales) * 100) : 0;
  const grossMarginPct = sales > 0 ? Math.round((salesMargin / sales) * 100) : 0;

  return { sales, salesMargin, cogs, grossProfit, opex, netProfit, marginPct, grossMarginPct };
}

export function computeCashFlowSeries(
  transactions: CashTransaction[],
  days = 14,
): CashFlowDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = new Map<string, CashFlowDay>();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    buckets.set(key, {
      date: key,
      label: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      inflow: 0,
      outflow: 0,
    });
  }

  for (const tx of transactions) {
    const key = localDateKey(tx.created_at);
    const bucket = buckets.get(key);
    if (!bucket) continue;

    if (tx.type === "income") bucket.inflow += tx.amount;
    else if (tx.type === "expense" && tx.category !== "HPP") bucket.outflow += tx.amount;
    else if (tx.type === "transfer") {
      if (tx.amount > 0) bucket.inflow += tx.amount;
      else bucket.outflow += Math.abs(tx.amount);
    }
  }

  return Array.from(buckets.values());
}

export function getMonthDateRange(reference = new Date()): { from: string; to: string } {
  const from = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const to = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return {
    from: localDateKey(from),
    to: localDateKey(to),
  };
}

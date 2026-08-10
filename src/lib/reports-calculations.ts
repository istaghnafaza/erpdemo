// =============================================================================
// Reports calculations — sales, P&L, audit kasir, selisih opname (Fase 13).
// =============================================================================

import { computeProfitLoss, getMonthDateRange as financeMonthRange, type ProfitLossSummary } from "@/lib/finance-calculations";
import {
  RECENT_TRANSACTIONS,
  SALES_HISTORY,
  TOP_PRODUCTS,
  USERS,
  PRODUCTS,
} from "@/lib/mock-data";
import { productId } from "@/lib/mock-pos-catalog";
import type { CashTransaction, StockMovement } from "@/types/database";
import type { MockProductOverride } from "@/stores/inventory.store";

export type ReportPeriod = "7" | "14" | "30";

export interface SalesDayRow {
  date: string;
  label: string;
  total: number;
  transactions: number;
}

export interface SalesSummary {
  totalSales: number;
  totalTransactions: number;
  avgTicket: number;
}

export interface TopProductRow {
  sku: string;
  name: string;
  qty: number;
  revenue: number;
}

export interface CashierAuditRow {
  id: string;
  name: string;
  role: string;
  transactions: number;
  revenue: number;
  voids: number;
  excessiveDiscounts: number;
}

export interface CashierTransactionRow {
  id: string;
  invoice: string;
  date: string;
  cashier: string;
  total: number;
  status: "completed" | "void";
}

export interface OpnameVarianceRow {
  id: string;
  reference: string;
  branchId: string;
  productName: string;
  sku: string;
  systemQty: number;
  physicalQty: number;
  variance: number;
  unitCost: number;
  estimatedLoss: number;
  date: string;
}

const BRANCH_SCALE: Record<string, number> = {
  "22221111-0000-0000-0000-000000000001": 0.38,
  "22221111-0000-0000-0000-000000000002": 0.34,
  "22221111-0000-0000-0000-000000000003": 0.28,
};

function branchScale(branchIds: string[], isConsolidated: boolean): number {
  if (isConsolidated) return 1;
  if (branchIds.length !== 1) return 1;
  return BRANCH_SCALE[branchIds[0]] ?? 0.33;
}

function formatDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function computeSalesReport(
  period: ReportPeriod,
  branchIds: string[],
  isConsolidated: boolean,
): { chart: SalesDayRow[]; summary: SalesSummary } {
  const scale = branchScale(branchIds, isConsolidated);
  const days = Number(period);
  const rows = SALES_HISTORY.slice(-days).map((d) => ({
    date: d.date,
    label: formatDayLabel(d.date),
    total: Math.round(d.total * scale),
    transactions: Math.max(1, Math.round(d.transactions * scale)),
  }));

  const totalSales = rows.reduce((s, r) => s + r.total, 0);
  const totalTransactions = rows.reduce((s, r) => s + r.transactions, 0);

  return {
    chart: rows,
    summary: {
      totalSales,
      totalTransactions,
      avgTicket: totalTransactions > 0 ? Math.round(totalSales / totalTransactions) : 0,
    },
  };
}

export function computeTopProductsReport(
  branchIds: string[],
  isConsolidated: boolean,
): TopProductRow[] {
  const scale = branchScale(branchIds, isConsolidated);
  return TOP_PRODUCTS.map((p) => ({
    sku: p.sku,
    name: p.name,
    qty: Math.max(1, Math.round(p.qty * scale)),
    revenue: Math.round(p.revenue * scale),
  }));
}

export function computeProfitLossReport(
  transactions: CashTransaction[],
  from: string,
  to: string,
  salesRecords?: import("@/types/sales-transactions").SalesTransactionRecord[],
): ProfitLossSummary {
  return computeProfitLoss(transactions, { from, to }, salesRecords);
}

export function computePaymentMethodBreakdown(): { name: string; value: number }[] {
  return [
    { name: "Tunai", value: 60 },
    { name: "Transfer", value: 20 },
    { name: "QRIS", value: 15 },
    { name: "Piutang", value: 5 },
  ];
}

export function computeCashierAudit(
  branchIds: string[],
  isConsolidated: boolean,
): { cashiers: CashierAuditRow[]; transactions: CashierTransactionRow[] } {
  const scale = branchScale(branchIds, isConsolidated);

  const cashiers = USERS.filter((u) => u.role === "kasir" || u.role === "manager").map((u) => {
    const trx = RECENT_TRANSACTIONS.filter((t) => t.cashier === u.name);
    const transactions =
      trx.length > 0 ? Math.max(1, Math.round(trx.length * scale)) : u.role === "kasir" ? 47 : 22;
    const revenue =
      trx.length > 0
        ? Math.round(trx.reduce((s, t) => s + t.total, 0) * scale)
        : Math.round((u.role === "kasir" ? 28_500_000 : 13_200_000) * scale);
    const voids =
      trx.filter((t) => t.status === "void").length > 0
        ? trx.filter((t) => t.status === "void").length
        : u.role === "kasir"
          ? 1
          : 0;

    return {
      id: u.id,
      name: u.name,
      role: u.role,
      transactions,
      revenue,
      voids,
      excessiveDiscounts: u.role === "kasir" && voids > 0 ? 1 : 0,
    };
  });

  const transactions = RECENT_TRANSACTIONS.map((t) => ({
    id: t.id,
    invoice: t.invoice,
    date: t.date,
    cashier: t.cashier,
    total: Math.round(t.total * scale),
    status: t.status,
  }));

  return { cashiers, transactions };
}

/** Demo selisih stock opname — estimasi kerugian dari qty × harga beli. */
export function computeOpnameVarianceReport(
  branchIds: string[],
  isConsolidated: boolean,
): OpnameVarianceRow[] {
  const rows: OpnameVarianceRow[] = [
    {
      id: "ov1",
      reference: "OPNAME-2026-0312",
      branchId: "22221111-0000-0000-0000-000000000001",
      productName: PRODUCTS[0].name,
      sku: PRODUCTS[0].sku,
      systemQty: 120,
      physicalQty: 118,
      variance: -2,
      unitCost: PRODUCTS[0].purchasePrice,
      estimatedLoss: 2 * PRODUCTS[0].purchasePrice,
      date: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      id: "ov2",
      reference: "OPNAME-2026-0312",
      branchId: "22221111-0000-0000-0000-000000000001",
      productName: PRODUCTS[2].name,
      sku: PRODUCTS[2].sku,
      systemQty: 45,
      physicalQty: 44,
      variance: -1,
      unitCost: PRODUCTS[2].purchasePrice,
      estimatedLoss: PRODUCTS[2].purchasePrice,
      date: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      id: "ov3",
      reference: "OPNAME-2026-0318",
      branchId: "22221111-0000-0000-0000-000000000002",
      productName: PRODUCTS[1].name,
      sku: PRODUCTS[1].sku,
      systemQty: 2000,
      physicalQty: 1995,
      variance: -5,
      unitCost: PRODUCTS[1].purchasePrice,
      estimatedLoss: 5 * PRODUCTS[1].purchasePrice,
      date: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: "ov4",
      reference: "OPNAME-2026-0318",
      branchId: "22221111-0000-0000-0000-000000000003",
      productName: PRODUCTS[4].name,
      sku: PRODUCTS[4].sku,
      systemQty: 88,
      physicalQty: 90,
      variance: 2,
      unitCost: PRODUCTS[4].purchasePrice,
      estimatedLoss: 0,
      date: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ];

  if (isConsolidated) return rows;
  return rows.filter((r) => branchIds.includes(r.branchId));
}

/** Selisih opname dari pergerakan stok aktual (mock / sinkron dengan sesi opname). */
export function computeOpnameVarianceFromMovements(
  movements: StockMovement[],
  branchIds: string[],
  productOverrides: Record<string, MockProductOverride>,
): OpnameVarianceRow[] {
  const resolveMeta = (pid: string) => {
    const override = productOverrides[pid];
    const seedIdx = PRODUCTS.findIndex((_, i) => productId(i) === pid);
    const seed = seedIdx >= 0 ? PRODUCTS[seedIdx] : undefined;
    return {
      sku: override?.sku ?? seed?.sku ?? pid.slice(0, 8),
      name: override?.name ?? seed?.name ?? "Produk",
      purchasePrice: override?.purchasePrice ?? seed?.purchasePrice ?? 0,
    };
  };

  return movements
    .filter((m) => m.type === "opname" && branchIds.includes(m.branch_id))
    .map((m) => {
      const meta = resolveMeta(m.product_id);
      const variance = m.qty_after - m.qty_before;
      return {
        id: m.id,
        reference: m.reference ?? "",
        branchId: m.branch_id,
        productName: meta.name,
        sku: meta.sku,
        systemQty: m.qty_before,
        physicalQty: m.qty_after,
        variance,
        unitCost: meta.purchasePrice,
        estimatedLoss: variance < 0 ? Math.abs(variance) * meta.purchasePrice : 0,
        date: m.created_at,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getMonthDateRange(): { from: string; to: string } {
  return financeMonthRange();
}

/** KPI ringan: agregasi penjualan multi-unit (qty jual vs qty dasar). */
export function summarizeMultiUnitSales(
  items: Array<{
    sell_unit_label?: string | null;
    qty: number;
    qty_base?: number | null;
    subtotal: number;
    unit?: string;
  }>,
): Array<{ unitLabel: string; qtySell: number; qtyBase: number; revenue: number }> {
  const map = new Map<string, { qtySell: number; qtyBase: number; revenue: number }>();
  for (const item of items) {
    const label = item.sell_unit_label || item.unit || "Satuan";
    const cur = map.get(label) ?? { qtySell: 0, qtyBase: 0, revenue: 0 };
    cur.qtySell += item.qty;
    cur.qtyBase += item.qty_base ?? item.qty;
    cur.revenue += item.subtotal;
    map.set(label, cur);
  }
  return Array.from(map.entries())
    .map(([unitLabel, v]) => ({ unitLabel, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}


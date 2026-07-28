// =============================================================================
// Daily sales rollup — populate daily_branch_sales (Fase C P2-2)
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";

const QRIS_METHODS = ["qris_edc", "qris_gopay", "qris_ovo", "qris_other"] as const;

export async function rollupDailySalesForDate(saleDate: string): Promise<number> {
  const db = getWriteDb();

  const result = await db.execute(sql`
    INSERT INTO daily_branch_sales (
      tenant_id, branch_id, sale_date, tx_count, total_revenue,
      cash_revenue, transfer_revenue, qris_revenue, credit_revenue, updated_at
    )
    SELECT
      st.tenant_id,
      st.branch_id,
      DATE(st.created_at AT TIME ZONE 'UTC') AS sale_date,
      COUNT(*)::int AS tx_count,
      COALESCE(SUM(st.grand_total), 0)::bigint AS total_revenue,
      COALESCE(SUM(CASE WHEN st.payment_method = 'cash' THEN st.grand_total ELSE 0 END), 0)::bigint AS cash_revenue,
      COALESCE(SUM(CASE WHEN st.payment_method = 'transfer' THEN st.grand_total ELSE 0 END), 0)::bigint AS transfer_revenue,
      COALESCE(SUM(CASE WHEN st.payment_method IN ('qris_edc', 'qris_gopay', 'qris_ovo', 'qris_other') THEN st.grand_total ELSE 0 END), 0)::bigint AS qris_revenue,
      COALESCE(SUM(CASE WHEN st.payment_method = 'credit' THEN st.grand_total ELSE 0 END), 0)::bigint AS credit_revenue,
      now()
    FROM sales_transactions st
    WHERE st.status = 'completed'
      AND DATE(st.created_at AT TIME ZONE 'UTC') = ${saleDate}::date
    GROUP BY st.tenant_id, st.branch_id, DATE(st.created_at AT TIME ZONE 'UTC')
    ON CONFLICT (tenant_id, branch_id, sale_date) DO UPDATE SET
      tx_count = EXCLUDED.tx_count,
      total_revenue = EXCLUDED.total_revenue,
      cash_revenue = EXCLUDED.cash_revenue,
      transfer_revenue = EXCLUDED.transfer_revenue,
      qris_revenue = EXCLUDED.qris_revenue,
      credit_revenue = EXCLUDED.credit_revenue,
      updated_at = now()
  `);

  const rowCount =
    typeof result === "object" && result !== null && "rowCount" in result
      ? Number((result as { rowCount?: number }).rowCount ?? 0)
      : 0;

  return rowCount;
}

export async function rollupDailySalesRange(fromDate: string, toDate: string): Promise<number> {
  let total = 0;
  const start = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().split("T")[0]!;
    total += await rollupDailySalesForDate(key);
  }

  return total;
}

/** Roll up yesterday — intended for nightly cron. */
export async function rollupYesterday(): Promise<{ date: string; rows: number }> {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  const date = d.toISOString().split("T")[0]!;
  const rows = await rollupDailySalesForDate(date);
  return { date, rows };
}

export { QRIS_METHODS };

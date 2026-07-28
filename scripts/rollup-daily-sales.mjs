#!/usr/bin/env node
/**
 * Roll up daily_branch_sales from sales_transactions.
 * Usage:
 *   npm run neon:rollup:daily
 *   npm run neon:rollup:daily -- 2026-07-01
 *   npm run neon:rollup:daily -- 2026-07-01 2026-07-24
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, neonConfig } from "@neondatabase/serverless";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(join(root, ".env"));

const ROLLUP_SQL = `
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
  AND DATE(st.created_at AT TIME ZONE 'UTC') = $1::date
GROUP BY st.tenant_id, st.branch_id, DATE(st.created_at AT TIME ZONE 'UTC')
ON CONFLICT (tenant_id, branch_id, sale_date) DO UPDATE SET
  tx_count = EXCLUDED.tx_count,
  total_revenue = EXCLUDED.total_revenue,
  cash_revenue = EXCLUDED.cash_revenue,
  transfer_revenue = EXCLUDED.transfer_revenue,
  qris_revenue = EXCLUDED.qris_revenue,
  credit_revenue = EXCLUDED.credit_revenue,
  updated_at = now()
`;

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error("ERROR: Set DATABASE_URL in .env");
  process.exit(1);
}

if (typeof globalThis.WebSocket === "undefined") {
  const { default: ws } = await import("ws");
  neonConfig.webSocketConstructor = ws;
}

const args = process.argv.slice(2);
const client = new Client(url);

function dateRange(from, to) {
  const dates = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

try {
  await client.connect();

  let dates;
  if (args.length === 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    dates = [d.toISOString().split("T")[0]];
  } else if (args.length === 1) {
    dates = [args[0]];
  } else {
    dates = dateRange(args[0], args[1]);
  }

  let totalRows = 0;
  for (const saleDate of dates) {
    const result = await client.query(ROLLUP_SQL, [saleDate]);
    totalRows += result.rowCount ?? 0;
    console.log(`ok ${saleDate} rows=${result.rowCount ?? 0}`);
  }

  console.log(JSON.stringify({ ok: true, dates, totalRows }, null, 2));
} catch (err) {
  console.error(
    JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }, null, 2),
  );
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}

// =============================================================================
// Idempotent — qty retur numeric (selaras sales_items.qty decimal)
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";

let ensured = false;
let ensuring: Promise<void> | null = null;

export async function ensureReturnsQtySchema(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    const db = getWriteDb();
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE sales_items
          ALTER COLUMN qty_returned TYPE numeric(18, 4) USING qty_returned::numeric;
      EXCEPTION WHEN undefined_table THEN NULL;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE sales_return_items
          ALTER COLUMN qty_sold TYPE numeric(18, 4) USING qty_sold::numeric;
        ALTER TABLE sales_return_items
          ALTER COLUMN qty_requested TYPE numeric(18, 4) USING qty_requested::numeric;
        ALTER TABLE sales_return_items
          ALTER COLUMN qty_qc_passed TYPE numeric(18, 4) USING qty_qc_passed::numeric;
      EXCEPTION WHEN undefined_table THEN NULL;
      END $$
    `);
    ensured = true;
  })();

  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

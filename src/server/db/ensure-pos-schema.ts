// =============================================================================
// Idempotent schema — POS sales columns (phase 11 + 14 essentials)
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";

let ensured = false;
let ensuring: Promise<void> | null = null;

/** Ensures columns required by current Drizzle schema for POS checkout. */
export async function ensurePosSchema(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    const db = getWriteDb();
    await db.execute(sql`
      ALTER TABLE sales_items
      ADD COLUMN IF NOT EXISTS is_so_line BOOLEAN NOT NULL DEFAULT false
    `);
    await db.execute(sql`
      ALTER TABLE sales_items
      ADD COLUMN IF NOT EXISTS qty_returned INT NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      ALTER TABLE sales_transactions
      ADD COLUMN IF NOT EXISTS return_status TEXT NOT NULL DEFAULT 'none'
    `);
    await db.execute(sql`
      ALTER TABLE sales_transactions
      ADD COLUMN IF NOT EXISTS return_offset_amount BIGINT NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      ALTER TABLE sales_transactions
      ADD COLUMN IF NOT EXISTS linked_return_id UUID
    `);
    ensured = true;
  })();

  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

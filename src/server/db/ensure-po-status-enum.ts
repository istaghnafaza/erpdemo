// =============================================================================
// Idempotent schema guard — po_status enum value awaiting_supplier
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";

let ensured = false;
let ensuring: Promise<void> | null = null;

/** Tambahkan nilai enum awaiting_supplier jika DB belum dimigrasi. */
export async function ensurePoStatusAwaitingSupplier(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    const db = getWriteDb();
    await db.execute(sql`
      ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'awaiting_supplier' BEFORE 'sent'
    `);
    ensured = true;
  })();

  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

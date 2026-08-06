// =============================================================================
// Idempotent schema guard — branches.payment_settings JSONB
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";

let ensured = false;
let ensuring: Promise<void> | null = null;

export async function ensureBranchPaymentSettingsColumn(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    const db = getWriteDb();
    await db.execute(sql`
      ALTER TABLE branches
        ADD COLUMN IF NOT EXISTS payment_settings JSONB NOT NULL DEFAULT '{}'::jsonb
    `);
    ensured = true;
  })();

  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

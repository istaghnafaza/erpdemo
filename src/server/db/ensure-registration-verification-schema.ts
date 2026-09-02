// =============================================================================
// Idempotent schema — email verification saat registrasi
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";

let ensured = false;
let ensuring: Promise<void> | null = null;

export async function ensureRegistrationVerificationSchema(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    const db = getWriteDb();
    await db.execute(sql`
      ALTER TABLE auth_users
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true
    `);
    await db.execute(sql`
      ALTER TABLE auth_users
        ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS registration_verification_otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        destination TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS registration_verification_otps_user_id_idx
        ON registration_verification_otps (user_id)
    `);
    ensured = true;
  })();

  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

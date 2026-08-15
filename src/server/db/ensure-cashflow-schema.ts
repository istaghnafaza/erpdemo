// =============================================================================
// Idempotent schema — Cashflow Intelligence (default accounts, transfers, owner capital)
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";

let ensured = false;
let ensuring: Promise<void> | null = null;

export async function ensureCashflowSchema(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    const db = getWriteDb();
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE owner_capital_kind AS ENUM ('prive_keluar', 'setoran_owner');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      ALTER TABLE cash_accounts
      ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false
    `);
    await db.execute(sql`
      ALTER TABLE cash_transactions
      ADD COLUMN IF NOT EXISTS counterpart_account_id UUID
    `);
    await db.execute(sql`
      ALTER TABLE cash_transactions
      ADD COLUMN IF NOT EXISTS pair_id UUID
    `);
    await db.execute(sql`
      ALTER TABLE so_fulfillments
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS owner_capital_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        cash_account_id UUID NOT NULL REFERENCES cash_accounts(id) ON DELETE RESTRICT,
        kind owner_capital_kind NOT NULL,
        amount BIGINT NOT NULL,
        occurred_at DATE NOT NULL,
        notes TEXT,
        created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS cash_accounts_one_default_per_type
      ON cash_accounts (tenant_id, branch_id, type)
      WHERE is_default = true AND is_active = true
    `);
    ensured = true;
  })();

  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

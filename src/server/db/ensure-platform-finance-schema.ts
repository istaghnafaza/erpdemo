// =============================================================================
// Idempotent schema — platform finance HPP + remote plan pricing (phase 18)
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";

let ensured = false;
let ensuring: Promise<void> | null = null;

export async function ensurePlatformFinanceSchema(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    const db = getWriteDb();

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_finance_settings (
        id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        monthly_hpp bigint NOT NULL DEFAULT 0,
        target_margin_pct integer NOT NULL DEFAULT 40,
        expected_paying_tenants integer NOT NULL DEFAULT 10,
        notes text,
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid
      )
    `);
    await db.execute(sql`
      INSERT INTO platform_finance_settings (id, monthly_hpp, target_margin_pct, expected_paying_tenants)
      VALUES (1, 0, 40, 10)
      ON CONFLICT (id) DO NOTHING
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_hpp_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        year_month text NOT NULL,
        amount bigint NOT NULL CHECK (amount >= 0),
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (year_month)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_platform_hpp_entries_ym
        ON platform_hpp_entries (year_month DESC)
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_plan_pricing (
        plan text PRIMARY KEY CHECK (plan IN ('basic', 'pro', 'enterprise')),
        monthly_amount bigint NOT NULL CHECK (monthly_amount >= 0),
        yearly_amount bigint NOT NULL CHECK (yearly_amount >= 0),
        is_active boolean NOT NULL DEFAULT true,
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid
      )
    `);
    await db.execute(sql`
      INSERT INTO platform_plan_pricing (plan, monthly_amount, yearly_amount)
      VALUES
        ('basic', 599000, 499000),
        ('pro', 849000, 749000),
        ('enterprise', 2499000, 1999000)
      ON CONFLICT (plan) DO NOTHING
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_hpp_expense_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        year_month text NOT NULL,
        label text NOT NULL,
        amount bigint NOT NULL CHECK (amount >= 0),
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_platform_hpp_expense_ym
        ON platform_hpp_expense_items (year_month, sort_order)
    `);

    ensured = true;
  })();

  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

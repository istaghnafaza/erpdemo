// =============================================================================
// Idempotent schema — platform product catalog + catalog requests
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";

let ensured = false;
let ensuring: Promise<void> | null = null;

export async function ensurePlatformCatalogTables(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    const db = getWriteDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_product_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version INTEGER NOT NULL DEFAULT 1,
        payload JSONB NOT NULL,
        published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        published_by UUID REFERENCES auth_users (id) ON DELETE SET NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS catalog_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
        tenant_name TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payload JSONB NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        resolved_at TIMESTAMPTZ,
        resolved_by UUID REFERENCES auth_users (id) ON DELETE SET NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_catalog_requests_status
      ON catalog_requests (status, created_at DESC)
    `);
    ensured = true;
  })();

  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

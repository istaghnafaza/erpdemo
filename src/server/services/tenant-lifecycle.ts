// =============================================================================
// Tenant lifecycle — auto-deactivate trial yang tidak upgrade
// =============================================================================

import { sql } from "drizzle-orm";
import { TRIAL_GRACE_DAYS } from "@/lib/plan-config";
import { getWriteDb } from "@/server/db";

export interface TrialDeactivationResult {
  deactivatedCount: number;
  tenantNames: string[];
}

/** Nonaktifkan trial yang sudah lewat masa trial + grace tanpa upgrade. */
export async function deactivateExpiredTrialTenants(): Promise<TrialDeactivationResult> {
  const db = getWriteDb();
  const graceDays = TRIAL_GRACE_DAYS;

  const result = await db.execute<{ id: string; name: string }>(sql`
    UPDATE tenants t
    SET is_active = false, updated_at = now()
    WHERE t.plan = 'trial'
      AND t.is_active = true
      AND t.trial_ends_at IS NOT NULL
      AND t.trial_ends_at + (${graceDays}::int * INTERVAL '1 day') <= now()
      AND NOT EXISTS (
        SELECT 1 FROM plan_invoices i
        WHERE i.tenant_id = t.id AND i.status = 'paid'
      )
      AND NOT EXISTS (
        SELECT 1 FROM tenant_subscriptions s
        WHERE s.tenant_id = t.id
          AND s.status = 'active'
          AND s.plan::text IN ('basic', 'pro', 'enterprise')
      )
    RETURNING t.id, t.name
  `);

  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: { id: string; name: string }[] }).rows ?? []);

  if (rows.length > 0) {
    for (const row of rows) {
      await db.execute(sql`
        UPDATE profiles
        SET is_active = false, updated_at = now()
        WHERE tenant_id = ${row.id}
      `);
    }
  }

  return {
    deactivatedCount: rows.length,
    tenantNames: rows.map((r) => r.name),
  };
}

/** Hapus tenant nonaktif agar email/username bisa dipakai registrasi ulang. */
export async function releaseInactiveTenantByEmail(email: string): Promise<boolean> {
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/server/db");
  const { authUsers, tenants } = await import("@/server/db/schema");

  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const existing = await db.query.authUsers.findFirst({
    where: eq(authUsers.email, normalized),
  });
  if (!existing?.tenantId) return false;

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, existing.tenantId),
  });
  if (!tenant || tenant.isActive) return false;

  await db.delete(tenants).where(eq(tenants.id, tenant.id));
  return true;
}

export async function releaseInactiveTenantByUsername(username: string): Promise<boolean> {
  const { sql, eq } = await import("drizzle-orm");
  const { getDb } = await import("@/server/db");
  const { authUsers, tenants } = await import("@/server/db/schema");

  const db = getDb();
  const normalized = username.trim().toLowerCase();
  const existing = await db.query.authUsers.findFirst({
    where: sql`lower(${authUsers.username}) = ${normalized}`,
  });
  if (!existing?.tenantId) return false;

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, existing.tenantId),
  });
  if (!tenant || tenant.isActive) return false;

  await db.delete(tenants).where(eq(tenants.id, tenant.id));
  return true;
}

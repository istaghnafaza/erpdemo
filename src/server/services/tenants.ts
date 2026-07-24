// =============================================================================
// Tenant service — Neon/Drizzle
// =============================================================================

import { eq, asc } from "drizzle-orm";
import { getDb } from "@/server/db";
import { toTenant } from "@/server/db/mappers";
import { tenants } from "@/server/db/schema";
import type { Tenant, TenantInsert, TenantUpdate } from "@/types/database";

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const db = getDb();
  const row = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
  return row ? toTenant(row) : null;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const db = getDb();
  const row = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });
  if (!row || !row.isActive) return null;
  return toTenant(row);
}

export async function listTenants(): Promise<Tenant[]> {
  const db = getDb();
  const rows = await db.query.tenants.findMany({ orderBy: asc(tenants.name) });
  return rows.map(toTenant);
}

export async function createTenant(payload: TenantInsert): Promise<Tenant> {
  const db = getDb();
  const [row] = await db
    .insert(tenants)
    .values({
      id: payload.id,
      name: payload.name,
      slug: payload.slug,
      ownerEmail: payload.owner_email,
      phone: payload.phone,
      plan: payload.plan,
      trialEndsAt: payload.trial_ends_at ? new Date(payload.trial_ends_at) : null,
      isActive: payload.is_active,
      onboardingComplete: payload.onboarding_complete,
      legacyModeActive: payload.legacy_mode_active,
      logoUrl: payload.logo_url,
    })
    .returning();
  return toTenant(row);
}

export async function updateTenant(tenantId: string, updates: TenantUpdate): Promise<Tenant | null> {
  const db = getDb();
  const patch: Partial<typeof tenants.$inferInsert> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.slug !== undefined) patch.slug = updates.slug;
  if (updates.owner_email !== undefined) patch.ownerEmail = updates.owner_email;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  if (updates.plan !== undefined) patch.plan = updates.plan;
  if (updates.trial_ends_at !== undefined) {
    patch.trialEndsAt = updates.trial_ends_at ? new Date(updates.trial_ends_at) : null;
  }
  if (updates.is_active !== undefined) patch.isActive = updates.is_active;
  if (updates.onboarding_complete !== undefined) patch.onboardingComplete = updates.onboarding_complete;
  if (updates.legacy_mode_active !== undefined) patch.legacyModeActive = updates.legacy_mode_active;
  if (updates.logo_url !== undefined) patch.logoUrl = updates.logo_url;

  const [row] = await db
    .update(tenants)
    .set(patch)
    .where(eq(tenants.id, tenantId))
    .returning();
  return row ? toTenant(row) : null;
}

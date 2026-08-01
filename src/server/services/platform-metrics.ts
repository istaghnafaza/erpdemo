// =============================================================================
// Platform metrics — cross-tenant overview for SES developer dashboard
// =============================================================================

import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export interface PlatformTenantRow {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  phone: string | null;
  plan: string;
  trialEndsAt: string | null;
  isActive: boolean;
  onboardingComplete: boolean;
  createdAt: string;
  ownerName: string | null;
  activeBranchCount: number;
  activeUserCount: number;
  revenue30d: number;
  txCount30d: number;
}

export interface PlatformOverview {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  onboardingPending: number;
  totalRevenue30d: number;
  totalTx30d: number;
}

type RawTenantRow = {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  phone: string | null;
  plan: string;
  trial_ends_at: Date | string | null;
  is_active: boolean;
  onboarding_complete: boolean;
  created_at: Date | string;
  owner_name: string | null;
  active_branch_count: number;
  active_user_count: number;
  revenue_30d: number | string | null;
  tx_count_30d: number | string | null;
};

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function listPlatformTenants(): Promise<PlatformTenantRow[]> {
  const db = getDb();
  const result = await db.execute<RawTenantRow>(sql`
    SELECT
      t.id,
      t.name,
      t.slug,
      t.owner_email,
      t.phone,
      t.plan,
      t.trial_ends_at,
      t.is_active,
      t.onboarding_complete,
      t.created_at,
      (
        SELECT p.name
        FROM profiles p
        WHERE p.tenant_id = t.id AND p.role = 'owner' AND p.is_active
        LIMIT 1
      ) AS owner_name,
      (
        SELECT COUNT(*)::int
        FROM branches b
        WHERE b.tenant_id = t.id AND b.is_active
      ) AS active_branch_count,
      (
        SELECT COUNT(*)::int
        FROM profiles p
        WHERE p.tenant_id = t.id AND p.is_active
      ) AS active_user_count,
      COALESCE((
        SELECT SUM(d.total_revenue)::bigint
        FROM daily_branch_sales d
        WHERE d.tenant_id = t.id AND d.sale_date >= CURRENT_DATE - INTERVAL '30 days'
      ), 0) AS revenue_30d,
      COALESCE((
        SELECT SUM(d.tx_count)::int
        FROM daily_branch_sales d
        WHERE d.tenant_id = t.id AND d.sale_date >= CURRENT_DATE - INTERVAL '30 days'
      ), 0) AS tx_count_30d
    FROM tenants t
    ORDER BY t.created_at DESC
  `);

  const rows = Array.isArray(result) ? result : (result.rows as RawTenantRow[]);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerEmail: row.owner_email,
    phone: row.phone,
    plan: row.plan,
    trialEndsAt: toIso(row.trial_ends_at),
    isActive: row.is_active,
    onboardingComplete: row.onboarding_complete,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    ownerName: row.owner_name,
    activeBranchCount: Number(row.active_branch_count ?? 0),
    activeUserCount: Number(row.active_user_count ?? 0),
    revenue30d: Number(row.revenue_30d ?? 0),
    txCount30d: Number(row.tx_count_30d ?? 0),
  }));
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const tenants = await listPlatformTenants();
  return {
    totalTenants: tenants.length,
    activeTenants: tenants.filter((t) => t.isActive).length,
    trialTenants: tenants.filter((t) => t.plan === "trial").length,
    onboardingPending: tenants.filter((t) => !t.onboardingComplete).length,
    totalRevenue30d: tenants.reduce((sum, t) => sum + t.revenue30d, 0),
    totalTx30d: tenants.reduce((sum, t) => sum + t.txCount30d, 0),
  };
}

// =============================================================================
// Platform metrics — cross-tenant overview for SES developer dashboard
// =============================================================================

import { sql } from "drizzle-orm";
import {
  getPlanMrrContribution,
  isPaidPlan,
  type BillingCycle,
} from "@/lib/plan-config";
import { getDb } from "@/server/db";
import { ensurePlanBillingSchema } from "@/server/db/ensure-plan-billing-schema";

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

export interface PlatformBillingKpis {
  /** Trial aktif & belum expired */
  activeTrials: number;
  /** % trial yang jadi paid dalam 7 hari (dari trial yang pernah ada / selesai 30h) */
  trialToPaidConversion7dPct: number;
  /** MRR dari langganan active */
  mrr: number;
  /** Sub past_due ATAU invoice failed 7 hari */
  pastDueCount: number;
  /** Jatuh tempo ≤7 hari (active/past_due) */
  renewingWithin7d: number;
}

export interface PlatformOverview {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  onboardingPending: number;
  totalRevenue30d: number;
  totalTx30d: number;
  billing: PlatformBillingKpis;
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

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const withRows = result as { rows?: T[] };
  return withRows.rows ?? [];
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

  const rows = rowsOf<RawTenantRow>(result);

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

export async function getPlatformBillingKpis(): Promise<PlatformBillingKpis> {
  await ensurePlanBillingSchema();
  const db = getDb();

  const activeTrialsResult = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count
    FROM tenants
    WHERE plan = 'trial'
      AND is_active = true
      AND (trial_ends_at IS NULL OR trial_ends_at > now())
  `);
  const activeTrials = Number(rowsOf<{ count: number }>(activeTrialsResult)[0]?.count ?? 0);

  // Cohort: tenants created as trial in last 30d that converted to paid within 7d of created_at
  // Approximation: paid tenants with first paid invoice within 7 days of tenant.created_at
  const conversionResult = await db.execute<{
    cohort: number;
    converted: number;
  }>(sql`
    WITH cohort AS (
      SELECT t.id, t.created_at
      FROM tenants t
      WHERE t.created_at >= now() - INTERVAL '30 days'
    ),
    converted AS (
      SELECT DISTINCT c.id
      FROM cohort c
      JOIN plan_invoices i ON i.tenant_id = c.id AND i.status = 'paid'
      WHERE i.paid_at IS NOT NULL
        AND i.paid_at <= c.created_at + INTERVAL '7 days'
    )
    SELECT
      (SELECT COUNT(*)::int FROM cohort) AS cohort,
      (SELECT COUNT(*)::int FROM converted) AS converted
  `);
  const conv = rowsOf<{ cohort: number; converted: number }>(conversionResult)[0];
  const cohort = Number(conv?.cohort ?? 0);
  const converted = Number(conv?.converted ?? 0);
  const trialToPaidConversion7dPct =
    cohort > 0 ? Math.round((converted / cohort) * 1000) / 10 : 0;

  const { getEffectivePlanPricing } = await import("@/server/services/platform-finance");
  const pricingMap = await getEffectivePlanPricing();

  const subsResult = await db.execute<{
    plan: string;
    billing_cycle: string;
  }>(sql`
    SELECT plan::text AS plan, billing_cycle::text AS billing_cycle
    FROM tenant_subscriptions
    WHERE status = 'active'
  `);
  let mrr = 0;
  for (const row of rowsOf<{ plan: string; billing_cycle: string }>(subsResult)) {
    if (!isPaidPlan(row.plan)) continue;
    const cycle = (row.billing_cycle === "yearly" ? "yearly" : "monthly") as BillingCycle;
    mrr += getPlanMrrContribution(row.plan, cycle, pricingMap);
  }

  const pastDueResult = await db.execute<{ count: number }>(sql`
    SELECT COUNT(DISTINCT x.tenant_id)::int AS count
    FROM (
      SELECT tenant_id FROM tenant_subscriptions WHERE status = 'past_due'
      UNION
      SELECT tenant_id FROM plan_invoices
      WHERE status = 'failed'
        AND updated_at >= now() - INTERVAL '7 days'
    ) x
  `);
  const pastDueCount = Number(rowsOf<{ count: number }>(pastDueResult)[0]?.count ?? 0);

  const renewResult = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count
    FROM tenant_subscriptions
    WHERE status IN ('active', 'past_due')
      AND current_period_end IS NOT NULL
      AND current_period_end >= now()
      AND current_period_end <= now() + INTERVAL '7 days'
  `);
  const renewingWithin7d = Number(rowsOf<{ count: number }>(renewResult)[0]?.count ?? 0);

  return {
    activeTrials,
    trialToPaidConversion7dPct,
    mrr,
    pastDueCount,
    renewingWithin7d,
  };
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const [tenants, billing] = await Promise.all([
    listPlatformTenants(),
    getPlatformBillingKpis().catch(() => ({
      activeTrials: 0,
      trialToPaidConversion7dPct: 0,
      mrr: 0,
      pastDueCount: 0,
      renewingWithin7d: 0,
    })),
  ]);
  return {
    totalTenants: tenants.length,
    activeTenants: tenants.filter((t) => t.isActive).length,
    trialTenants: tenants.filter((t) => t.plan === "trial").length,
    onboardingPending: tenants.filter((t) => !t.onboardingComplete).length,
    totalRevenue30d: tenants.reduce((sum, t) => sum + t.revenue30d, 0),
    totalTx30d: tenants.reduce((sum, t) => sum + t.txCount30d, 0),
    billing,
  };
}

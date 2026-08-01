// =============================================================================
// Plan limits enforcement — branches & users per subscription tier
// =============================================================================

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  getPlanLimits,
  isTrialExpired,
  planLimitErrorMessage,
  trialExpiredMessage,
} from "@/lib/plan-config";
import type { TenantPlan } from "@/types/app";
import { profiles } from "@/server/db/schema";
import { countActiveBranches } from "@/server/services/branches";
import { getTenantById } from "@/server/services/tenants";

async function countActiveUsers(tenantId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profiles)
    .where(and(eq(profiles.tenantId, tenantId), eq(profiles.isActive, true)));
  return row?.count ?? 0;
}

function assertTrialActive(plan: TenantPlan, trialEndsAt: string | null): void {
  if (plan !== "trial") return;
  if (isTrialExpired(trialEndsAt)) {
    throw new Error(trialExpiredMessage());
  }
}

export async function assertCanAddBranch(tenantId: string): Promise<void> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error("Tenant tidak ditemukan");

  assertTrialActive(tenant.plan, tenant.trial_ends_at);

  const limits = getPlanLimits(tenant.plan);
  const current = await countActiveBranches(tenantId);
  if (current >= limits.maxBranches) {
    throw new Error(
      planLimitErrorMessage(tenant.plan, "branch", current, limits.maxBranches),
    );
  }
}

export async function assertCanAddUser(tenantId: string): Promise<void> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error("Tenant tidak ditemukan");

  assertTrialActive(tenant.plan, tenant.trial_ends_at);

  const limits = getPlanLimits(tenant.plan);
  const current = await countActiveUsers(tenantId);
  if (current >= limits.maxUsers) {
    throw new Error(planLimitErrorMessage(tenant.plan, "user", current, limits.maxUsers));
  }
}

export async function getTenantPlanUsage(tenantId: string) {
  const tenant = await getTenantById(tenantId);
  if (!tenant) return null;

  const limits = getPlanLimits(tenant.plan);
  const [activeBranches, activeUsers] = await Promise.all([
    countActiveBranches(tenantId),
    countActiveUsers(tenantId),
  ]);

  return {
    plan: tenant.plan,
    trialEndsAt: tenant.trial_ends_at,
    trialExpired: tenant.plan === "trial" && isTrialExpired(tenant.trial_ends_at),
    limits,
    usage: {
      branches: activeBranches,
      users: activeUsers,
    },
    canAddBranch:
      tenant.plan !== "trial" || !isTrialExpired(tenant.trial_ends_at)
        ? activeBranches < limits.maxBranches
        : false,
    canAddUser:
      tenant.plan !== "trial" || !isTrialExpired(tenant.trial_ends_at)
        ? activeUsers < limits.maxUsers
        : false,
  };
}

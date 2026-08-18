// =============================================================================
// Client API — subscription plan usage
// =============================================================================

import { isNeonBackend } from "@/lib/api/backend";
import {
  getPlanLimits,
  getTenantAccessStatus,
  isTenantOperational,
  isTrialExpired,
  trialDaysRemaining,
  type TenantAccessStatus,
} from "@/lib/plan-config";
import type { TenantPlan } from "@/types/app";
import type { Tenant } from "@/types/database";

export interface TenantPlanUsage {
  plan: TenantPlan;
  trialEndsAt: string | null;
  planRenewsAt?: string | null;
  trialExpired: boolean;
  trialDaysLeft: number;
  accessStatus?: TenantAccessStatus;
  operational?: boolean;
  limits: { maxBranches: number; maxUsers: number; label: string };
  usage: { branches: number; users: number };
  canAddBranch: boolean;
  canAddUser: boolean;
}

export async function getTenantPlanUsage(
  tenantId: string,
  fallback?: {
    tenant: Tenant | null;
    branchCount: number;
    userCount: number;
  },
): Promise<TenantPlanUsage | null> {
  if (isNeonBackend()) {
    const { neonGetTenantPlanUsage } = await import("@/lib/api/neon/fns");
    const raw = await neonGetTenantPlanUsage({ data: { tenantId } });
    return {
      plan: raw.plan as TenantPlan,
      trialEndsAt: raw.trialEndsAt,
      planRenewsAt: raw.planRenewsAt,
      trialExpired: raw.trialExpired,
      trialDaysLeft: trialDaysRemaining(raw.trialEndsAt),
      accessStatus: raw.accessStatus,
      operational: raw.operational,
      limits: raw.limits,
      usage: raw.usage,
      canAddBranch: raw.canAddBranch,
      canAddUser: raw.canAddUser,
    };
  }

  if (!fallback?.tenant) return null;
  const { tenant, branchCount, userCount } = fallback;
  const limits = getPlanLimits(tenant.plan);
  const trialExpired = tenant.plan === "trial" && isTrialExpired(tenant.trial_ends_at);
  const operational = isTenantOperational(tenant);
  return {
    plan: tenant.plan,
    trialEndsAt: tenant.trial_ends_at,
    planRenewsAt: tenant.plan_renews_at,
    trialExpired,
    trialDaysLeft: trialDaysRemaining(tenant.trial_ends_at),
    accessStatus: getTenantAccessStatus(tenant),
    operational,
    limits,
    usage: { branches: branchCount, users: userCount },
    canAddBranch: operational && branchCount < limits.maxBranches,
    canAddUser: operational && userCount < limits.maxUsers,
  };
}

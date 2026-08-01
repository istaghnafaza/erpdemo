// =============================================================================
// Client API — subscription plan usage
// =============================================================================

import { isNeonBackend } from "@/lib/api/backend";
import { getPlanLimits, isTrialExpired, trialDaysRemaining } from "@/lib/plan-config";
import type { TenantPlan } from "@/types/app";
import type { Tenant } from "@/types/database";

export interface TenantPlanUsage {
  plan: TenantPlan;
  trialEndsAt: string | null;
  trialExpired: boolean;
  trialDaysLeft: number;
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
      trialExpired: raw.trialExpired,
      trialDaysLeft: trialDaysRemaining(raw.trialEndsAt),
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
  return {
    plan: tenant.plan,
    trialEndsAt: tenant.trial_ends_at,
    trialExpired,
    trialDaysLeft: trialDaysRemaining(tenant.trial_ends_at),
    limits,
    usage: { branches: branchCount, users: userCount },
    canAddBranch: !trialExpired && branchCount < limits.maxBranches,
    canAddUser: !trialExpired && userCount < limits.maxUsers,
  };
}

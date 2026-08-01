// =============================================================================
// Client-side plan guard — before navigating to add-branch / add-user flows
// =============================================================================

import {
  getPlanLimits,
  isTrialExpired,
  planLimitErrorMessage,
  trialExpiredMessage,
} from "@/lib/plan-config";
import type { Tenant } from "@/types/database";

export function checkCanAddBranchClient(
  tenant: Tenant | null | undefined,
  activeBranchCount: number,
): { ok: true } | { ok: false; message: string } {
  if (!tenant) return { ok: false, message: "Data toko belum dimuat" };

  if (tenant.plan === "trial" && isTrialExpired(tenant.trial_ends_at)) {
    return { ok: false, message: trialExpiredMessage() };
  }

  const limits = getPlanLimits(tenant.plan);
  if (activeBranchCount >= limits.maxBranches) {
    return {
      ok: false,
      message: planLimitErrorMessage(tenant.plan, "branch", activeBranchCount, limits.maxBranches),
    };
  }

  return { ok: true };
}

export function checkCanAddUserClient(
  tenant: Tenant | null | undefined,
  activeUserCount: number,
): { ok: true } | { ok: false; message: string } {
  if (!tenant) return { ok: false, message: "Data toko belum dimuat" };

  if (tenant.plan === "trial" && isTrialExpired(tenant.trial_ends_at)) {
    return { ok: false, message: trialExpiredMessage() };
  }

  const limits = getPlanLimits(tenant.plan);
  if (activeUserCount >= limits.maxUsers) {
    return {
      ok: false,
      message: planLimitErrorMessage(tenant.plan, "user", activeUserCount, limits.maxUsers),
    };
  }

  return { ok: true };
}

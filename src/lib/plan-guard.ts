// =============================================================================
// Client-side plan guard — before navigating to add-branch / add-user flows
// =============================================================================

import {
  getPlanLimits,
  getTenantAccessStatus,
  isTenantOperational,
  planLimitErrorMessage,
  subscriptionLockedMessage,
} from "@/lib/plan-config";
import type { Tenant } from "@/types/database";

export function checkTenantOperational(
  tenant: Tenant | null | undefined,
): { ok: true } | { ok: false; message: string } {
  if (!tenant) return { ok: false, message: "Data toko belum dimuat" };
  if (isTenantOperational(tenant)) return { ok: true };
  return { ok: false, message: subscriptionLockedMessage(getTenantAccessStatus(tenant)) };
}

export function checkCanAddBranchClient(
  tenant: Tenant | null | undefined,
  activeBranchCount: number,
): { ok: true } | { ok: false; message: string } {
  const operational = checkTenantOperational(tenant);
  if (!operational.ok) return operational;
  if (!tenant) return { ok: false, message: "Data toko belum dimuat" };

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
  const operational = checkTenantOperational(tenant);
  if (!operational.ok) return operational;
  if (!tenant) return { ok: false, message: "Data toko belum dimuat" };

  const limits = getPlanLimits(tenant.plan);
  if (activeUserCount >= limits.maxUsers) {
    return {
      ok: false,
      message: planLimitErrorMessage(tenant.plan, "user", activeUserCount, limits.maxUsers),
    };
  }

  return { ok: true };
}

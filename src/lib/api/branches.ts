// =============================================================================
// Branches API
// =============================================================================

import { db as supabase, ok, fail, queryMany, isNeonBackend } from "./client";
import { withResponseCache, invalidateResponseCache } from "./response-cache";
import { neonCall } from "./backend";
import {
  neonAssignUserToBranch,
  neonCreateBranch,
  neonFinalizeOnboardingPrimaryBranch,
  neonGetActiveBranches,
  neonGetBranch,
  neonGetBranches,
  neonGetBranchesWithManager,
  neonGetUserBranches,
  neonGetBranchCloseBlockers,
  neonForceCloseAllOpenCashierSessionsForBranch,
  neonRemoveUserFromBranch,
  neonUpdateBranch,
} from "@/lib/api/neon/fns";
import type { ApiResponse } from "@/types/app";
import type { Branch, BranchInsert, BranchUpdate, Profile } from "@/types/database";

export interface BranchWithManager extends Branch {
  manager: Pick<Profile, "id" | "name" | "email"> | null;
}

export interface OpenCashierSessionInfo {
  id: string;
  cashier_id: string;
  cashier_name: string;
  opened_at: string;
  expected_cash_balance: number;
  active_carts: number;
}

export interface BranchCloseBlockers {
  openCashierSessions: number;
  openSessions: OpenCashierSessionInfo[];
  pendingTransfers: number;
  activeSalesOrders: number;
  blocked: boolean;
  blockReason: string | null;
  warnings: string[];
}

export interface ForceCloseBranchSessionsResult {
  closedCount: number;
  cancelledCarts: number;
}

export async function getBranches(tenantId: string): Promise<ApiResponse<Branch[]>> {
  return withResponseCache(`branches:${tenantId}:all`, 60_000, async () => {
    if (isNeonBackend()) {
      const result = await neonCall(() => neonGetBranches({ data: { tenantId } }));
      if (result.error) return fail(result.error);
      return ok(result.data ?? []);
    }
    return queryMany(() =>
      supabase.from("branches").select("*").eq("tenant_id", tenantId).order("name"),
    );
  });
}

export async function getActiveBranches(tenantId: string): Promise<ApiResponse<Branch[]>> {
  return withResponseCache(`branches:${tenantId}:active`, 60_000, async () => {
    if (isNeonBackend()) {
      const result = await neonCall(() => neonGetActiveBranches({ data: { tenantId } }));
      if (result.error) return fail(result.error);
      return ok(result.data ?? []);
    }
    return queryMany(() =>
      supabase
        .from("branches")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name"),
    );
  });
}

export async function getBranchesWithManager(
  tenantId: string,
): Promise<ApiResponse<BranchWithManager[]>> {
  return withResponseCache(`branches:${tenantId}:with-manager`, 60_000, async () => {
    if (isNeonBackend()) {
      const result = await neonCall(() => neonGetBranchesWithManager({ data: { tenantId } }));
      if (result.error) return fail(result.error);
      return ok(result.data ?? []);
    }
    return queryMany(() =>
      supabase
        .from("branches")
        .select("*, manager:manager_id(id, name, email)")
        .eq("tenant_id", tenantId)
        .order("name"),
    );
  });
}

export async function getBranch(
  tenantId: string,
  branchId: string,
): Promise<ApiResponse<Branch>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonGetBranch({ data: { tenantId, branchId } }));
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Cabang tidak ditemukan");
    return ok(result.data);
  }

  try {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", branchId)
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function getUserBranches(
  tenantId: string,
  userId: string,
): Promise<ApiResponse<Branch[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonGetUserBranches({ data: { tenantId, userId } }));
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }

  return queryMany(() =>
    supabase
      .from("user_branches")
      .select("branch:branch_id(*)")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data, error }: { data: any; error: any }) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: error ? null : (data ?? []).map((r: any) => r.branch as Branch),
        error,
      })),
  );
}

export async function createBranch(
  tenantId: string,
  payload: Omit<BranchInsert, "tenant_id">,
): Promise<ApiResponse<Branch>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonCreateBranch({ data: { tenantId, payload } }));
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat cabang");
    invalidateResponseCache(`branches:${tenantId}:`);
    return ok(result.data);
  }

  try {
    const { data, error } = await supabase
      .from("branches")
      .insert({ ...payload, tenant_id: tenantId })
      .select()
      .single();
    if (error) return fail(error);
    invalidateResponseCache(`branches:${tenantId}:`);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

/** Onboarding go-live — update cabang registrasi, bukan insert duplikat. */
export async function finalizeOnboardingPrimaryBranch(
  tenantId: string,
  payload: Omit<BranchInsert, "tenant_id">,
): Promise<ApiResponse<Branch>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonFinalizeOnboardingPrimaryBranch({ data: { tenantId, payload } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal menyiapkan cabang");
    invalidateResponseCache(`branches:${tenantId}:`);
    return ok(result.data);
  }
  return createBranch(tenantId, payload);
}

export async function updateBranch(
  tenantId: string,
  branchId: string,
  updates: BranchUpdate,
): Promise<ApiResponse<Branch>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateBranch({ data: { tenantId, branchId, updates } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Cabang tidak ditemukan");
    invalidateResponseCache(`branches:${tenantId}:`);
    return ok(result.data);
  }

  try {
    const { data, error } = await supabase
      .from("branches")
      .update(updates)
      .eq("tenant_id", tenantId)
      .eq("id", branchId)
      .select()
      .single();
    if (error) return fail(error);
    invalidateResponseCache(`branches:${tenantId}:`);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function deactivateBranch(
  tenantId: string,
  branchId: string,
): Promise<ApiResponse<Branch>> {
  return updateBranch(tenantId, branchId, { is_active: false });
}

export async function getBranchCloseBlockers(
  tenantId: string,
  branchId: string,
): Promise<ApiResponse<BranchCloseBlockers>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetBranchCloseBlockers({ data: { tenantId, branchId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal memeriksa status toko");
    return ok(result.data);
  }
  // Supabase path — basic check not implemented; allow close
  return ok({
    openCashierSessions: 0,
    openSessions: [],
    pendingTransfers: 0,
    activeSalesOrders: 0,
    blocked: false,
    blockReason: null,
    warnings: [],
  });
}

export async function forceCloseAllOpenCashierSessionsForBranch(
  tenantId: string,
  branchId: string,
): Promise<ApiResponse<ForceCloseBranchSessionsResult>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonForceCloseAllOpenCashierSessionsForBranch({ data: { tenantId, branchId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal menutup sesi kasir");
    return ok(result.data);
  }
  return ok({ closedCount: 0, cancelledCarts: 0 });
}

export async function assignUserToBranch(
  tenantId: string,
  userId: string,
  branchId: string,
): Promise<ApiResponse<null>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonAssignUserToBranch({ data: { tenantId, userId, branchId } }),
    );
    if (result.error) return fail(result.error);
    return ok(null);
  }

  try {
    const { error } = await supabase
      .from("user_branches")
      .upsert({ user_id: userId, branch_id: branchId, tenant_id: tenantId });
    if (error) return fail(error);
    return ok(null);
  } catch (err) {
    return fail(err);
  }
}

export async function removeUserFromBranch(
  tenantId: string,
  userId: string,
  branchId: string,
): Promise<ApiResponse<null>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonRemoveUserFromBranch({ data: { tenantId, userId, branchId } }),
    );
    if (result.error) return fail(result.error);
    return ok(null);
  }

  try {
    const { error } = await supabase
      .from("user_branches")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("branch_id", branchId);
    if (error) return fail(error);
    return ok(null);
  } catch (err) {
    return fail(err);
  }
}

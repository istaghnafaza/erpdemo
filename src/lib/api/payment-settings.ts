// =============================================================================
// Branch payment settings API
// =============================================================================

import { db as supabase, ok, fail, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import {
  neonGetBranchPaymentSettings,
  neonUpdateBranchPaymentSettings,
} from "@/lib/api/neon/payment-settings-fns";
import type { ApiResponse } from "@/types/app";
import type { BranchPaymentSettings } from "@/types/payment-settings";

export async function getBranchPaymentSettings(
  tenantId: string,
  branchId: string,
): Promise<ApiResponse<BranchPaymentSettings>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetBranchPaymentSettings({ data: { tenantId, branchId } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? { transferAccounts: [], qrisEntries: [] });
  }
  return ok({ transferAccounts: [], qrisEntries: [] });
}

export async function saveBranchPaymentSettings(
  tenantId: string,
  branchId: string,
  settings: BranchPaymentSettings,
): Promise<ApiResponse<BranchPaymentSettings>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateBranchPaymentSettings({ data: { tenantId, branchId, settings } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal menyimpan pengaturan pembayaran");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("branches")
      .update({ payment_settings: settings })
      .eq("tenant_id", tenantId)
      .eq("id", branchId)
      .select("payment_settings")
      .single();
    if (error) return fail(error);
    return ok((data?.payment_settings as BranchPaymentSettings) ?? settings);
  } catch (err) {
    return fail(err);
  }
}

// =============================================================================
// Nav counts API — sidebar badges (Sprint 3 P1-5)
// =============================================================================

import { ok, fail, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import { neonGetModuleNavCounts } from "@/lib/api/neon/fns";
import type { ApiResponse, ModuleNavCounts } from "@/types/app";

export async function getModuleNavCounts(
  tenantId: string,
  branchId: string,
): Promise<ApiResponse<ModuleNavCounts>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetModuleNavCounts({ data: { tenantId, branchId } }),
    );
    if (result.error) return fail(result.error);
    return ok(
      result.data ?? { deliveries: 0, sales_orders: 0, online_orders: 0 },
    );
  }
  return ok({ deliveries: 0, sales_orders: 0, online_orders: 0 });
}

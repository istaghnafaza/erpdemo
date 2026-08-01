// =============================================================================
// Deliveries API — Neon + mock fallback
// =============================================================================

import { isNeonBackend, ok, fail } from "@/lib/api/client";
import { neonCall } from "@/lib/api/backend";
import type { ApiResponse } from "@/types/app";
import type { DeliveryRecord, UpdateDeliveryDraft } from "@/types/deliveries";

export async function listDeliveries(
  tenantId: string,
  branchIds: string[],
): Promise<ApiResponse<DeliveryRecord[]>> {
  if (isNeonBackend()) {
    const { neonListDeliveries } = await import("@/lib/api/neon/delivery-fns");
    const result = await neonCall(() => neonListDeliveries({ data: { tenantId, branchIds } }));
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return ok([]);
}

export async function updateDelivery(
  tenantId: string,
  deliveryId: string,
  patch: UpdateDeliveryDraft,
): Promise<ApiResponse<DeliveryRecord>> {
  if (isNeonBackend()) {
    const { neonUpdateDelivery } = await import("@/lib/api/neon/delivery-fns");
    const result = await neonCall(() =>
      neonUpdateDelivery({ data: { tenantId, deliveryId, patch } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Pengiriman tidak ditemukan");
    return ok(result.data);
  }
  return fail("Backend Neon diperlukan");
}

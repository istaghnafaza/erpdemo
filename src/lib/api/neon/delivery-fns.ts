// =============================================================================
// Neon RPC — deliveries
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type { DeliveryRecord, UpdateDeliveryDraft } from "@/types/deliveries";

async function requireTenant(tenantId: string) {
  const { assertTenant, requireRequestSession } = await import("@/server/auth/request-session");
  const session = await requireRequestSession();
  assertTenant(session, tenantId);
  return session;
}

export const neonListDeliveries = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchIds: string[] }) => data)
  .handler(async ({ data }): Promise<DeliveryRecord[]> => {
    await requireTenant(data.tenantId);
    const { listDeliveriesForBranches } = await import("@/server/services/deliveries");
    return listDeliveriesForBranches(data.tenantId, data.branchIds);
  });

export const neonUpdateDelivery = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; deliveryId: string; patch: UpdateDeliveryDraft }) => data,
  )
  .handler(async ({ data }): Promise<DeliveryRecord> => {
    await requireTenant(data.tenantId);
    const { updateDeliveryById } = await import("@/server/services/deliveries");
    const row = await updateDeliveryById(data.tenantId, data.deliveryId, data.patch);
    if (!row) throw new Error("Pengiriman tidak ditemukan");
    return row;
  });

// =============================================================================
// Plan billing — Neon server functions (checkout Snap + manual mark paid)
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type { BillingCycle } from "@/lib/plan-config";

async function sessionHelpers() {
  return import("@/server/auth/request-session");
}

export const neonCreatePlanCheckout = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; plan: string; billingCycle?: BillingCycle }) => data,
  )
  .handler(async ({ data }) => {
    const { assertTenantRoles, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    await assertTenantRoles(session, data.tenantId, ["owner"]);
    const { createPlanCheckout } = await import("@/server/services/plan-billing");
    return createPlanCheckout({
      tenantId: data.tenantId,
      plan: data.plan,
      billingCycle: data.billingCycle,
    });
  });

export const neonMarkPlanInvoicePaidManual = createServerFn({ method: "POST" })
  .validator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    await requirePlatformAdminSession();
    const { markPlanInvoicePaidManual } = await import("@/server/services/plan-billing");
    return markPlanInvoicePaidManual({ orderId: data.orderId });
  });

export const neonRunPlanRenewCheck = createServerFn({ method: "POST" }).handler(async () => {
  const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
  await requirePlatformAdminSession();
  const { runPlanRenewCheck } = await import("@/server/services/plan-billing");
  return runPlanRenewCheck();
});

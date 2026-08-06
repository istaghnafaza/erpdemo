import { createServerFn } from "@tanstack/react-start";
import type { BranchPaymentSettings } from "@/types/payment-settings";

async function sessionHelpers() {
  const [session, requestSession] = await Promise.all([
    import("@/server/auth/session"),
    import("@/server/auth/request-session"),
  ]);
  return { ...session, ...requestSession };
}

export const neonGetBranchPaymentSettings = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string }) => data)
  .handler(async ({ data }) => {
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    const { getBranchPaymentSettings } = await import("@/server/services/branches");
    return getBranchPaymentSettings(data.tenantId, data.branchId);
  });

export const neonUpdateBranchPaymentSettings = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; branchId: string; settings: BranchPaymentSettings }) => data,
  )
  .handler(async ({ data }) => {
    const { assertTenantRoles, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    await assertTenantRoles(session, data.tenantId, ["owner", "manager"]);
    const { updateBranchPaymentSettings } = await import("@/server/services/branches");
    return updateBranchPaymentSettings(data.tenantId, data.branchId, data.settings);
  });

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

export const neonCreatePlanTransferCheckout = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; plan: string; billingCycle?: BillingCycle }) => data,
  )
  .handler(async ({ data }) => {
    const { assertTenantRoles, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    await assertTenantRoles(session, data.tenantId, ["owner"]);
    const { createPlanTransferCheckout } = await import(
      "@/server/services/plan-transfer-billing"
    );
    return createPlanTransferCheckout({
      tenantId: data.tenantId,
      plan: data.plan,
      billingCycle: data.billingCycle,
    });
  });

export const neonSubmitPlanPaymentProof = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      orderId: string;
      imageBase64: string;
      mimeType: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { assertTenantRoles, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    await assertTenantRoles(session, data.tenantId, ["owner"]);
    const { submitPlanPaymentProof } = await import(
      "@/server/services/plan-transfer-billing"
    );
    return submitPlanPaymentProof(data);
  });

export const neonGetPlanTransferStatus = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; orderId: string }) => data)
  .handler(async ({ data }) => {
    const { assertTenantRoles, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    await assertTenantRoles(session, data.tenantId, ["owner"]);
    const { getPlanTransferCheckoutStatus } = await import(
      "@/server/services/plan-transfer-billing"
    );
    return getPlanTransferCheckoutStatus(data);
  });

export const neonListPlanTransferReview = createServerFn({ method: "POST" }).handler(async () => {
  const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
  await requirePlatformAdminSession();
  const { listPlanInvoicesForReview } = await import(
    "@/server/services/plan-transfer-billing"
  );
  return listPlanInvoicesForReview();
});

export const neonApprovePlanTransferReview = createServerFn({ method: "POST" })
  .validator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    await requirePlatformAdminSession();
    const { approvePlanTransferReview } = await import(
      "@/server/services/plan-transfer-billing"
    );
    return approvePlanTransferReview(data.orderId);
  });

export const neonRejectPlanTransferReview = createServerFn({ method: "POST" })
  .validator((data: { orderId: string; reason?: string }) => data)
  .handler(async ({ data }) => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    await requirePlatformAdminSession();
    const { rejectPlanTransferReview } = await import(
      "@/server/services/plan-transfer-billing"
    );
    await rejectPlanTransferReview(data.orderId, data.reason);
    return { ok: true };
  });

export const neonIngestBcaMutasiPaste = createServerFn({ method: "POST" })
  .validator((data: { body: string; subject?: string }) => data)
  .handler(async ({ data }) => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    await requirePlatformAdminSession();
    const { ingestBcaMutasiNotification } = await import(
      "@/server/services/plan-transfer-billing"
    );
    return ingestBcaMutasiNotification({
      body: data.body,
      subject: data.subject,
    });
  });

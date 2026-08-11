// =============================================================================
// Platform finance — Neon server functions
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type { PaidTenantPlan } from "@/lib/plan-config";

export const neonGetPublicPlanPricing = createServerFn({ method: "GET" }).handler(async () => {
  const { getEffectivePlanPricing } = await import("@/server/services/platform-finance");
  return getEffectivePlanPricing();
});

export const neonGetPlatformFinance = createServerFn({ method: "POST" })
  .validator((data: { yearMonth?: string | null } = {}) => data ?? {})
  .handler(async ({ data }) => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    await requirePlatformAdminSession();
    const { getPlatformFinanceBundle, countActivePaidTenants } = await import(
      "@/server/services/platform-finance"
    );
    const [bundle, activePaidTenants] = await Promise.all([
      getPlatformFinanceBundle({ yearMonth: data?.yearMonth }),
      countActivePaidTenants(),
    ]);
    return { ...bundle, activePaidTenants };
  });

export const neonUpdatePlatformFinanceSettings = createServerFn({ method: "POST" })
  .validator(
    (data: {
      targetMarginPct: number;
      expectedPayingTenants: number;
      notes?: string | null;
      yearMonth: string;
      expenses: Array<{ label: string; amount: number }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    const session = await requirePlatformAdminSession();
    const { updatePlatformFinanceSettings } = await import("@/server/services/platform-finance");
    return updatePlatformFinanceSettings({
      ...data,
      updatedBy: session.sub,
    });
  });

export const neonUpsertPlatformPlanPricing = createServerFn({ method: "POST" })
  .validator(
    (data: {
      plans: Array<{
        plan: PaidTenantPlan;
        monthly: number;
        yearly: number;
        isActive?: boolean;
      }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    const session = await requirePlatformAdminSession();
    const { upsertPlatformPlanPricing } = await import("@/server/services/platform-finance");
    return upsertPlatformPlanPricing({
      plans: data.plans,
      updatedBy: session.sub,
    });
  });

export const neonApplySuggestedPlanPricing = createServerFn({ method: "POST" }).handler(
  async () => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    const session = await requirePlatformAdminSession();
    const { applySuggestedPricing } = await import("@/server/services/platform-finance");
    return applySuggestedPricing({ updatedBy: session.sub });
  },
);

export const neonPreviewPricingSuggestion = createServerFn({ method: "POST" })
  .validator(
    (data: {
      monthlyHpp: number;
      expectedPayingTenants: number;
      targetMarginPct: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    await requirePlatformAdminSession();
    const { suggestPlanPricing } = await import("@/server/services/platform-finance");
    return suggestPlanPricing(data);
  });

import { neonCall } from "@/lib/api/backend";
import {
  neonApplySuggestedPlanPricing,
  neonGetPlatformFinance,
  neonGetPublicPlanPricing,
  neonPreviewPricingSuggestion,
  neonUpdatePlatformFinanceSettings,
  neonUpsertPlatformPlanPricing,
} from "@/lib/api/neon/platform-finance-fns";
import type { PaidTenantPlan, PlanPricing } from "@/lib/plan-config";
import type { ApiResponse } from "@/types/app";

export type PlanPricingMap = Record<PaidTenantPlan, PlanPricing>;

export async function getPublicPlanPricing(): Promise<ApiResponse<PlanPricingMap>> {
  const result = await neonCall(() => neonGetPublicPlanPricing());
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: "Gagal memuat harga paket" };
  return { data: result.data, error: null };
}

export async function getPlatformFinance(yearMonth?: string | null) {
  return neonCall(() => neonGetPlatformFinance({ data: { yearMonth } }));
}

export async function updatePlatformFinanceSettings(input: {
  targetMarginPct: number;
  expectedPayingTenants: number;
  notes?: string | null;
  yearMonth: string;
  expenses: Array<{ label: string; amount: number }>;
}) {
  return neonCall(() => neonUpdatePlatformFinanceSettings({ data: input }));
}

export async function upsertPlatformPlanPricing(
  plans: Array<{
    plan: PaidTenantPlan;
    monthly: number;
    yearly: number;
    isActive?: boolean;
  }>,
) {
  return neonCall(() => neonUpsertPlatformPlanPricing({ data: { plans } }));
}

export async function applySuggestedPlanPricing() {
  return neonCall(() => neonApplySuggestedPlanPricing());
}

export async function previewPricingSuggestion(input: {
  monthlyHpp: number;
  expectedPayingTenants: number;
  targetMarginPct: number;
}) {
  return neonCall(() => neonPreviewPricingSuggestion({ data: input }));
}

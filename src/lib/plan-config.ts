// =============================================================================
// SEPS subscription plans — pricing, limits, helpers (shared client + server)
// =============================================================================

import type { TenantPlan } from "@/types/app";

export const TRIAL_DAYS = 7;

export type BillingCycle = "monthly" | "yearly";

export interface PlanPricing {
  monthly: number;
  yearly: number;
}

export interface PlanLimits {
  maxBranches: number;
  maxUsers: number;
  label: string;
}

export const PLAN_PRICING: Record<Exclude<TenantPlan, "trial">, PlanPricing> = {
  basic: { monthly: 599_000, yearly: 499_000 },
  pro: { monthly: 849_000, yearly: 749_000 },
  enterprise: { monthly: 2_499_000, yearly: 1_999_000 },
};

/** Batas cabang & user per paket berbayar. Trial mengikuti limit Pro selama masa aktif. */
export const PLAN_LIMITS: Record<TenantPlan, PlanLimits> = {
  trial: { maxBranches: 2, maxUsers: 15, label: "Trial (7 hari)" },
  basic: { maxBranches: 1, maxUsers: 5, label: "Basic" },
  pro: { maxBranches: 2, maxUsers: 15, label: "Pro" },
  enterprise: { maxBranches: 999, maxUsers: 999, label: "Enterprise" },
};

export type PaidTenantPlan = Exclude<TenantPlan, "trial">;

export function isPaidPlan(plan: string): plan is PaidTenantPlan {
  return plan === "basic" || plan === "pro" || plan === "enterprise";
}

/** Gross amount (IDR) for Midtrans / invoice.
 * `PLAN_PRICING.*.yearly` = harga /bulan saat bayar tahunan (hemat ~17%);
 * tagihan tahunan = yearly × 12.
 */
export function getPlanCheckoutAmount(plan: PaidTenantPlan, cycle: BillingCycle): number {
  const pricing = PLAN_PRICING[plan];
  return cycle === "yearly" ? pricing.yearly * 12 : pricing.monthly;
}

/** MRR contribution for an active paid subscription (yearly sticker = monthly equiv). */
export function getPlanMrrContribution(plan: PaidTenantPlan, cycle: BillingCycle): number {
  const pricing = PLAN_PRICING[plan];
  return cycle === "yearly" ? pricing.yearly : pricing.monthly;
}

export function getPlanPeriodDays(cycle: BillingCycle): number {
  return cycle === "yearly" ? 365 : 30;
}

export function formatPlanPrice(amount: number): string {
  if (amount >= 1_000_000) {
    const jt = amount / 1_000_000;
    return jt % 1 === 0 ? `Rp ${jt} jt` : `Rp ${jt.toFixed(3).replace(".", ",")} jt`;
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getPlanLimits(plan: TenantPlan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.basic;
}

export function isTrialExpired(trialEndsAt: string | Date | null | undefined): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() < Date.now();
}

export function trialDaysRemaining(trialEndsAt: string | Date | null | undefined): number {
  if (!trialEndsAt) return 0;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function suggestUpgradePlan(plan: TenantPlan, forResource: "branch" | "user"): TenantPlan {
  if (forResource === "branch") {
    if (plan === "trial" || plan === "basic" || plan === "pro") return "enterprise";
    return "enterprise";
  }
  if (plan === "trial" || plan === "basic") return "pro";
  if (plan === "pro") return "enterprise";
  return "enterprise";
}

export function planLimitErrorMessage(
  plan: TenantPlan,
  resource: "branch" | "user",
  current: number,
  max: number,
): string {
  const upgrade = suggestUpgradePlan(plan, resource);
  const upgradeLabel = PLAN_LIMITS[upgrade].label;
  if (resource === "branch") {
    return `Batas cabang paket ${PLAN_LIMITS[plan].label} (${max}) tercapai (${current}/${max}). Upgrade ke ${upgradeLabel} untuk menambah cabang.`;
  }
  return `Batas user paket ${PLAN_LIMITS[plan].label} (${max}) tercapai (${current}/${max}). Upgrade ke ${upgradeLabel} untuk menambah pegawai.`;
}

export function trialExpiredMessage(): string {
  return "Masa trial 7 hari telah berakhir. Upgrade ke Basic, Pro, atau Enterprise untuk melanjutkan menambah cabang/pegawai.";
}

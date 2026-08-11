// =============================================================================
// Platform finance — HPP bulanan, remote plan pricing, saran estimasi
// =============================================================================

import { asc, desc, eq, sql } from "drizzle-orm";
import {
  PLAN_PRICING,
  type PaidTenantPlan,
  type PlanPricing,
} from "@/lib/plan-config";
import { getWriteDb } from "@/server/db";
import { ensurePlatformFinanceSchema } from "@/server/db/ensure-platform-finance-schema";
import {
  platformFinanceSettings,
  platformHppEntries,
  platformHppExpenseItems,
  platformPlanPricing,
} from "@/server/db/schema";

export type PlanPricingMap = Record<PaidTenantPlan, PlanPricing>;

export interface PlatformFinanceSettingsDto {
  monthlyHpp: number;
  targetMarginPct: number;
  expectedPayingTenants: number;
  notes: string | null;
  updatedAt: string | null;
}

export interface PlatformHppEntryDto {
  id: string;
  yearMonth: string;
  amount: number;
  notes: string | null;
  updatedAt: string;
}

export interface PlatformHppExpenseItemDto {
  id: string;
  yearMonth: string;
  label: string;
  amount: number;
  sortOrder: number;
}

export interface PlatformPlanPricingRow {
  plan: PaidTenantPlan;
  monthly: number;
  yearly: number;
  isActive: boolean;
  updatedAt: string | null;
}

export interface PricingSuggestion {
  assumptions: {
    monthlyHpp: number;
    expectedPayingTenants: number;
    targetMarginPct: number;
    costPerTenant: number;
    floorPerTenant: number;
    yearlyDiscountPct: number;
  };
  suggested: PlanPricingMap;
  insights: {
    breakEvenTenantsAtPro: number;
    blendedArpu: number;
    contributionPerTenant: number;
    monthlyProfitAtTarget: number;
    affordableNote: string;
    worthNote: string;
  };
}

const YEARLY_DISCOUNT = 0.17;
/** Relative to Pro (anchor = floor). */
const TIER_MULT: Record<PaidTenantPlan, number> = {
  basic: 0.7,
  pro: 1,
  enterprise: 2.9,
};
/** Assumed mix for blended ARPU when estimating. */
const MIX: Record<PaidTenantPlan, number> = {
  basic: 0.35,
  pro: 0.5,
  enterprise: 0.15,
};

function roundPrice(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Round to nearest Rp 1.000 for sticker readability
  return Math.max(1_000, Math.round(n / 1_000) * 1_000);
}

function defaultPricingMap(): PlanPricingMap {
  return {
    basic: { ...PLAN_PRICING.basic },
    pro: { ...PLAN_PRICING.pro },
    enterprise: { ...PLAN_PRICING.enterprise },
  };
}

export function suggestPlanPricing(input: {
  monthlyHpp: number;
  expectedPayingTenants: number;
  targetMarginPct: number;
}): PricingSuggestion {
  const monthlyHpp = Math.max(0, Math.floor(input.monthlyHpp || 0));
  const expected = Math.max(1, Math.floor(input.expectedPayingTenants || 1));
  const marginPct = Math.min(90, Math.max(0, Math.floor(input.targetMarginPct || 0)));

  const costPerTenant = monthlyHpp / expected;
  const floorPerTenant = costPerTenant * (1 + marginPct / 100);

  const suggested = {} as PlanPricingMap;
  for (const plan of ["basic", "pro", "enterprise"] as PaidTenantPlan[]) {
    const monthly = roundPrice(floorPerTenant * TIER_MULT[plan]);
    const yearly = roundPrice(monthly * (1 - YEARLY_DISCOUNT));
    suggested[plan] = { monthly, yearly };
  }

  const blendedArpu =
    suggested.basic.monthly * MIX.basic +
    suggested.pro.monthly * MIX.pro +
    suggested.enterprise.monthly * MIX.enterprise;

  const contributionPerTenant = blendedArpu - costPerTenant;
  const monthlyProfitAtTarget = contributionPerTenant * expected;
  const breakEvenTenantsAtPro =
    suggested.pro.monthly > 0
      ? Math.max(1, Math.ceil(monthlyHpp / suggested.pro.monthly))
      : expected;

  return {
    assumptions: {
      monthlyHpp,
      expectedPayingTenants: expected,
      targetMarginPct: marginPct,
      costPerTenant: Math.round(costPerTenant),
      floorPerTenant: roundPrice(floorPerTenant),
      yearlyDiscountPct: Math.round(YEARLY_DISCOUNT * 100),
    },
    suggested,
    insights: {
      breakEvenTenantsAtPro,
      blendedArpu: Math.round(blendedArpu),
      contributionPerTenant: Math.round(contributionPerTenant),
      monthlyProfitAtTarget: Math.round(monthlyProfitAtTarget),
      affordableNote:
        "Basic ≈ 70% lantai biaya+margin (entry toko tunggal). Pro = jangkar. Enterprise ≈ 2,9× untuk multi-cabang.",
      worthNote:
        contributionPerTenant > 0
          ? `Pada target ${expected} tenant, estimasi kontribusi ≈ positif setelah HPP tertutup.`
          : "HPP masih lebih tinggi dari ARPU — naikkan harga, turunkan HPP, atau naikkan target tenant.",
    },
  };
}

export async function getEffectivePlanPricing(): Promise<PlanPricingMap> {
  await ensurePlatformFinanceSchema();
  const db = getWriteDb();
  const rows = await db.select().from(platformPlanPricing);
  const map = defaultPricingMap();
  for (const row of rows) {
    if (row.plan !== "basic" && row.plan !== "pro" && row.plan !== "enterprise") continue;
    if (!row.isActive) continue;
    map[row.plan] = {
      monthly: Number(row.monthlyAmount),
      yearly: Number(row.yearlyAmount),
    };
  }
  return map;
}

export async function getPlatformFinanceBundle(input?: {
  yearMonth?: string | null;
}): Promise<{
  settings: PlatformFinanceSettingsDto;
  pricing: PlatformPlanPricingRow[];
  hppEntries: PlatformHppEntryDto[];
  expenses: PlatformHppExpenseItemDto[];
  activeYearMonth: string;
  suggestion: PricingSuggestion;
}> {
  await ensurePlatformFinanceSchema();
  const db = getWriteDb();

  const [settingsRow] = await db.select().from(platformFinanceSettings).limit(1);
  const settings: PlatformFinanceSettingsDto = {
    monthlyHpp: Number(settingsRow?.monthlyHpp ?? 0),
    targetMarginPct: Number(settingsRow?.targetMarginPct ?? 40),
    expectedPayingTenants: Number(settingsRow?.expectedPayingTenants ?? 10),
    notes: settingsRow?.notes ?? null,
    updatedAt: settingsRow?.updatedAt?.toISOString() ?? null,
  };

  const pricingRows = await db.select().from(platformPlanPricing);
  const pricing: PlatformPlanPricingRow[] = (["basic", "pro", "enterprise"] as PaidTenantPlan[]).map(
    (plan) => {
      const row = pricingRows.find((r) => r.plan === plan);
      if (row) {
        return {
          plan,
          monthly: Number(row.monthlyAmount),
          yearly: Number(row.yearlyAmount),
          isActive: row.isActive,
          updatedAt: row.updatedAt?.toISOString() ?? null,
        };
      }
      return {
        plan,
        monthly: PLAN_PRICING[plan].monthly,
        yearly: PLAN_PRICING[plan].yearly,
        isActive: true,
        updatedAt: null,
      };
    },
  );

  const hppRaw = await db
    .select()
    .from(platformHppEntries)
    .orderBy(desc(platformHppEntries.yearMonth))
    .limit(24);

  const hppEntries: PlatformHppEntryDto[] = hppRaw.map((r) => ({
    id: r.id,
    yearMonth: r.yearMonth,
    amount: Number(r.amount),
    notes: r.notes,
    updatedAt: r.updatedAt.toISOString(),
  }));

  const now = new Date();
  const defaultYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const activeYearMonth =
    input?.yearMonth && /^\d{4}-\d{2}$/.test(input.yearMonth) ? input.yearMonth : defaultYm;

  const expenseRows = await db
    .select()
    .from(platformHppExpenseItems)
    .where(eq(platformHppExpenseItems.yearMonth, activeYearMonth))
    .orderBy(asc(platformHppExpenseItems.sortOrder));

  const expenses: PlatformHppExpenseItemDto[] = expenseRows.map((r) => ({
    id: r.id,
    yearMonth: r.yearMonth,
    label: r.label,
    amount: Number(r.amount),
    sortOrder: r.sortOrder,
  }));

  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const monthlyHppForSuggest = expenseTotal > 0 ? expenseTotal : settings.monthlyHpp;

  const suggestion = suggestPlanPricing({
    monthlyHpp: monthlyHppForSuggest,
    expectedPayingTenants: settings.expectedPayingTenants,
    targetMarginPct: settings.targetMarginPct,
  });

  return {
    settings: { ...settings, monthlyHpp: monthlyHppForSuggest },
    pricing,
    hppEntries,
    expenses,
    activeYearMonth,
    suggestion,
  };
}

export async function updatePlatformFinanceSettings(input: {
  targetMarginPct: number;
  expectedPayingTenants: number;
  notes?: string | null;
  updatedBy?: string | null;
  yearMonth: string;
  expenses: Array<{ label: string; amount: number }>;
}): Promise<PlatformFinanceSettingsDto> {
  await ensurePlatformFinanceSchema();
  const db = getWriteDb();
  const now = new Date();
  const ym = input.yearMonth.trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    throw new Error("Format bulan harus YYYY-MM");
  }

  const cleaned = input.expenses
    .map((e, i) => ({
      label: e.label.trim(),
      amount: Math.max(0, Math.floor(e.amount || 0)),
      sortOrder: i,
    }))
    .filter((e) => e.label.length > 0 || e.amount > 0);

  for (const e of cleaned) {
    if (!e.label) throw new Error("Setiap pengeluaran harus punya nama");
  }

  const monthlyHpp = cleaned.reduce((s, e) => s + e.amount, 0);
  const targetMarginPct = Math.min(90, Math.max(0, Math.floor(input.targetMarginPct)));
  const expectedPayingTenants = Math.max(1, Math.floor(input.expectedPayingTenants));

  await db
    .insert(platformFinanceSettings)
    .values({
      id: 1,
      monthlyHpp,
      targetMarginPct,
      expectedPayingTenants,
      notes: input.notes ?? null,
      updatedAt: now,
      updatedBy: input.updatedBy ?? null,
    })
    .onConflictDoUpdate({
      target: platformFinanceSettings.id,
      set: {
        monthlyHpp,
        targetMarginPct,
        expectedPayingTenants,
        notes: input.notes ?? null,
        updatedAt: now,
        updatedBy: input.updatedBy ?? null,
      },
    });

  await db
    .insert(platformHppEntries)
    .values({
      yearMonth: ym,
      amount: monthlyHpp,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: platformHppEntries.yearMonth,
      set: {
        amount: monthlyHpp,
        notes: input.notes ?? null,
        updatedAt: now,
      },
    });

  await db.delete(platformHppExpenseItems).where(eq(platformHppExpenseItems.yearMonth, ym));
  if (cleaned.length > 0) {
    await db.insert(platformHppExpenseItems).values(
      cleaned.map((e) => ({
        yearMonth: ym,
        label: e.label,
        amount: e.amount,
        sortOrder: e.sortOrder,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  return {
    monthlyHpp,
    targetMarginPct,
    expectedPayingTenants,
    notes: input.notes ?? null,
    updatedAt: now.toISOString(),
  };
}

export async function upsertPlatformPlanPricing(input: {
  plans: Array<{ plan: PaidTenantPlan; monthly: number; yearly: number; isActive?: boolean }>;
  updatedBy?: string | null;
}): Promise<PlatformPlanPricingRow[]> {
  await ensurePlatformFinanceSchema();
  const db = getWriteDb();
  const now = new Date();

  for (const p of input.plans) {
    if (!["basic", "pro", "enterprise"].includes(p.plan)) {
      throw new Error(`Plan tidak valid: ${p.plan}`);
    }
    const monthly = Math.max(0, Math.floor(p.monthly));
    const yearly = Math.max(0, Math.floor(p.yearly));
    await db
      .insert(platformPlanPricing)
      .values({
        plan: p.plan,
        monthlyAmount: monthly,
        yearlyAmount: yearly,
        isActive: p.isActive ?? true,
        updatedAt: now,
        updatedBy: input.updatedBy ?? null,
      })
      .onConflictDoUpdate({
        target: platformPlanPricing.plan,
        set: {
          monthlyAmount: monthly,
          yearlyAmount: yearly,
          isActive: p.isActive ?? true,
          updatedAt: now,
          updatedBy: input.updatedBy ?? null,
        },
      });
  }

  const bundle = await getPlatformFinanceBundle();
  return bundle.pricing;
}

/** Apply suggestion directly to live remote pricing. */
export async function applySuggestedPricing(input: {
  updatedBy?: string | null;
}): Promise<PlatformPlanPricingRow[]> {
  const bundle = await getPlatformFinanceBundle();
  const plans = (["basic", "pro", "enterprise"] as PaidTenantPlan[]).map((plan) => ({
    plan,
    monthly: bundle.suggestion.suggested[plan].monthly,
    yearly: bundle.suggestion.suggested[plan].yearly,
    isActive: true,
  }));
  return upsertPlatformPlanPricing({ plans, updatedBy: input.updatedBy });
}

export async function countActivePaidTenants(): Promise<number> {
  await ensurePlatformFinanceSchema();
  const db = getWriteDb();
  const result = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count
    FROM tenants
    WHERE is_active = true AND plan IN ('basic', 'pro', 'enterprise')
  `);
  const rows = Array.isArray(result) ? result : ((result as { rows?: { count: number }[] }).rows ?? []);
  return Number(rows[0]?.count ?? 0);
}

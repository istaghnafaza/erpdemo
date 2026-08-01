// =============================================================================
// Pricing service — CRUD konfigurasi tier + bundle untuk POS
// =============================================================================

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  categoryMarginFloors,
  customerPriceTiers,
  pricingOverrideLogs,
  pricingSettings,
  volumePriceTiers,
} from "@/server/db/schema";
import {
  defaultCustomerTiers,
  defaultPricingSettings,
  defaultVolumeTiers,
} from "@/lib/pricing-defaults";
import type {
  CategoryMarginFloor,
  CustomerPriceTier,
  PricingBundle,
  PricingOverrideInput,
  PricingSettings,
  VolumePriceTier,
} from "@/types/pricing";

function mapSettings(row: typeof pricingSettings.$inferSelect): PricingSettings {
  return {
    tenant_id: row.tenantId,
    max_stack_discount_percent: row.maxStackDiscountPercent,
    max_line_discount_percent: row.maxLineDiscountPercent,
    default_min_margin_percent: row.defaultMinMarginPercent,
    updated_at: row.updatedAt.toISOString(),
    updated_by: row.updatedBy,
  };
}

function mapVolume(row: typeof volumePriceTiers.$inferSelect): VolumePriceTier {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    tier_code: row.tierCode,
    name: row.name,
    min_qty: row.minQty,
    min_line_amount: row.minLineAmount,
    discount_percent: row.discountPercent,
    sort_order: row.sortOrder,
    is_active: row.isActive,
  };
}

function mapCustomerTier(row: typeof customerPriceTiers.$inferSelect): CustomerPriceTier {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    tier_code: row.tierCode,
    name: row.name,
    discount_percent: row.discountPercent,
    min_transactions: row.minTransactions,
    min_rolling_omzet: row.minRollingOmzet,
    rolling_days: row.rollingDays,
    description: row.description,
    sort_order: row.sortOrder,
    is_active: row.isActive,
  };
}

function mapCategoryMargin(row: typeof categoryMarginFloors.$inferSelect): CategoryMarginFloor {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    category_id: row.categoryId,
    min_margin_percent: row.minMarginPercent,
  };
}

export async function ensurePricingDefaults(tenantId: string): Promise<void> {
  const db = getDb();

  const existingSettings = await db.query.pricingSettings.findFirst({
    where: eq(pricingSettings.tenantId, tenantId),
  });
  if (!existingSettings) {
    const defs = defaultPricingSettings(tenantId);
    await db.insert(pricingSettings).values({
      tenantId,
      maxStackDiscountPercent: defs.max_stack_discount_percent,
      maxLineDiscountPercent: defs.max_line_discount_percent,
      defaultMinMarginPercent: defs.default_min_margin_percent,
    });
  }

  const volCount = await db.query.volumePriceTiers.findMany({
    where: eq(volumePriceTiers.tenantId, tenantId),
  });
  if (volCount.length === 0) {
    await db.insert(volumePriceTiers).values(
      defaultVolumeTiers(tenantId).map((t) => ({
        tenantId: t.tenant_id,
        tierCode: t.tier_code,
        name: t.name,
        minQty: t.min_qty,
        minLineAmount: t.min_line_amount,
        discountPercent: t.discount_percent,
        sortOrder: t.sort_order,
        isActive: t.is_active,
      })),
    );
  }

  const custCount = await db.query.customerPriceTiers.findMany({
    where: eq(customerPriceTiers.tenantId, tenantId),
  });
  if (custCount.length === 0) {
    await db.insert(customerPriceTiers).values(
      defaultCustomerTiers(tenantId).map((t) => ({
        tenantId: t.tenant_id,
        tierCode: t.tier_code,
        name: t.name,
        discountPercent: t.discount_percent,
        minTransactions: t.min_transactions,
        minRollingOmzet: t.min_rolling_omzet,
        rollingDays: t.rolling_days,
        description: t.description,
        sortOrder: t.sort_order,
        isActive: t.is_active,
      })),
    );
  }
}

export async function getPricingBundle(tenantId: string): Promise<PricingBundle> {
  await ensurePricingDefaults(tenantId);
  const db = getDb();

  const settingsRow = await db.query.pricingSettings.findFirst({
    where: eq(pricingSettings.tenantId, tenantId),
  });
  const volumeRows = await db.query.volumePriceTiers.findMany({
    where: eq(volumePriceTiers.tenantId, tenantId),
  });
  const customerRows = await db.query.customerPriceTiers.findMany({
    where: eq(customerPriceTiers.tenantId, tenantId),
  });
  const marginRows = await db.query.categoryMarginFloors.findMany({
    where: eq(categoryMarginFloors.tenantId, tenantId),
  });

  return {
    settings: settingsRow
      ? mapSettings(settingsRow)
      : defaultPricingSettings(tenantId),
    volume_tiers: volumeRows.map(mapVolume).sort((a, b) => a.sort_order - b.sort_order),
    customer_tiers: customerRows.map(mapCustomerTier).sort((a, b) => a.sort_order - b.sort_order),
    category_margins: marginRows.map(mapCategoryMargin),
  };
}

export async function updatePricingSettings(
  tenantId: string,
  updates: {
    max_stack_discount_percent?: number;
    max_line_discount_percent?: number;
    default_min_margin_percent?: number;
  },
  userId: string,
): Promise<PricingSettings> {
  await ensurePricingDefaults(tenantId);
  const db = getDb();

  const patch: Partial<typeof pricingSettings.$inferInsert> = {
    updatedBy: userId,
    updatedAt: new Date(),
  };
  if (updates.max_stack_discount_percent != null) {
    patch.maxStackDiscountPercent = updates.max_stack_discount_percent;
  }
  if (updates.max_line_discount_percent != null) {
    patch.maxLineDiscountPercent = updates.max_line_discount_percent;
  }
  if (updates.default_min_margin_percent != null) {
    patch.defaultMinMarginPercent = updates.default_min_margin_percent;
  }

  const [row] = await db
    .update(pricingSettings)
    .set(patch)
    .where(eq(pricingSettings.tenantId, tenantId))
    .returning();

  return mapSettings(row);
}

export async function replaceVolumeTiers(
  tenantId: string,
  tiers: VolumePriceTier[],
): Promise<VolumePriceTier[]> {
  await ensurePricingDefaults(tenantId);
  const db = getDb();

  for (const t of tiers) {
    await db
      .update(volumePriceTiers)
      .set({
        name: t.name,
        minQty: t.min_qty,
        minLineAmount: t.min_line_amount,
        discountPercent: t.discount_percent,
        sortOrder: t.sort_order,
        isActive: t.is_active,
      })
      .where(and(eq(volumePriceTiers.tenantId, tenantId), eq(volumePriceTiers.tierCode, t.tier_code)));
  }

  const rows = await db.query.volumePriceTiers.findMany({
    where: eq(volumePriceTiers.tenantId, tenantId),
  });
  return rows.map(mapVolume).sort((a, b) => a.sort_order - b.sort_order);
}

export async function replaceCustomerTiers(
  tenantId: string,
  tiers: CustomerPriceTier[],
): Promise<CustomerPriceTier[]> {
  await ensurePricingDefaults(tenantId);
  const db = getDb();

  for (const t of tiers) {
    await db
      .update(customerPriceTiers)
      .set({
        name: t.name,
        discountPercent: t.discount_percent,
        minTransactions: t.min_transactions,
        minRollingOmzet: t.min_rolling_omzet,
        rollingDays: t.rolling_days,
        description: t.description,
        sortOrder: t.sort_order,
        isActive: t.is_active,
      })
      .where(
        and(eq(customerPriceTiers.tenantId, tenantId), eq(customerPriceTiers.tierCode, t.tier_code)),
      );
  }

  const rows = await db.query.customerPriceTiers.findMany({
    where: eq(customerPriceTiers.tenantId, tenantId),
  });
  return rows.map(mapCustomerTier).sort((a, b) => a.sort_order - b.sort_order);
}

export async function replaceCategoryMargins(
  tenantId: string,
  margins: Omit<CategoryMarginFloor, "tenant_id">[],
): Promise<CategoryMarginFloor[]> {
  const db = getDb();
  await db.delete(categoryMarginFloors).where(eq(categoryMarginFloors.tenantId, tenantId));
  if (margins.length > 0) {
    await db.insert(categoryMarginFloors).values(
      margins.map((m) => ({
        id: m.id.startsWith("new-") ? undefined : m.id,
        tenantId,
        categoryId: m.category_id,
        minMarginPercent: m.min_margin_percent,
      })),
    );
  }
  const rows = await db.query.categoryMarginFloors.findMany({
    where: eq(categoryMarginFloors.tenantId, tenantId),
  });
  return rows.map(mapCategoryMargin);
}

export async function logPricingOverride(input: PricingOverrideInput): Promise<void> {
  const db = getDb();
  await db.insert(pricingOverrideLogs).values({
    tenantId: input.tenant_id,
    branchId: input.branch_id,
    salesTransactionId: input.sales_transaction_id ?? null,
    productId: input.product_id,
    sku: input.sku,
    basePrice: input.base_price,
    floorPrice: input.floor_price,
    overridePrice: input.override_price,
    reason: input.reason,
    createdBy: input.created_by,
  });
}

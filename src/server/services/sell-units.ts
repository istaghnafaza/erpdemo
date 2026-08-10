// =============================================================================
// Product sell units — multi-satuan jual (barang curah Model A)
// =============================================================================

import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { productSellUnits, products } from "@/server/db/schema";
import { stockStr, toProductSellUnit } from "@/server/db/mappers";
import type { ProductSellUnit, SellUnitInput } from "@/lib/product-sell-units";
import { normalizePresetQty, roundQty } from "@/lib/product-sell-units";

export async function listSellUnitsForProduct(
  tenantId: string,
  productId: string,
  includeInactive = false,
): Promise<ProductSellUnit[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(productSellUnits)
    .where(
      and(
        eq(productSellUnits.tenantId, tenantId),
        eq(productSellUnits.productId, productId),
        ...(includeInactive ? [] : [eq(productSellUnits.isActive, true)]),
      ),
    )
    .orderBy(asc(productSellUnits.sortOrder), asc(productSellUnits.label));
  return rows.map(toProductSellUnit);
}

export async function listSellUnitsForProducts(
  tenantId: string,
  productIds: string[],
): Promise<Map<string, ProductSellUnit[]>> {
  const map = new Map<string, ProductSellUnit[]>();
  if (productIds.length === 0) return map;

  const db = getDb();
  const rows = await db
    .select()
    .from(productSellUnits)
    .where(
      and(
        eq(productSellUnits.tenantId, tenantId),
        inArray(productSellUnits.productId, productIds),
        eq(productSellUnits.isActive, true),
      ),
    )
    .orderBy(asc(productSellUnits.sortOrder));

  for (const row of rows) {
    const unit = toProductSellUnit(row);
    const list = map.get(unit.product_id) ?? [];
    list.push(unit);
    map.set(unit.product_id, list);
  }
  return map;
}

function sanitizeUnitInput(input: SellUnitInput, index: number) {
  const label = String(input.label ?? "").trim();
  if (!label) throw new Error("Label satuan jual wajib diisi");
  const factor = roundQty(Number(input.factor_to_base), 6);
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`Faktor konversi satuan "${label}" harus > 0`);
  }
  return {
    label,
    factorToBase: stockStr(factor),
    sellingPrice:
      input.selling_price != null && Number(input.selling_price) > 0
        ? Math.round(Number(input.selling_price))
        : null,
    purchasePrice:
      input.purchase_price != null && Number(input.purchase_price) > 0
        ? Math.round(Number(input.purchase_price))
        : null,
    sortOrder: input.sort_order ?? index + 1,
    isActive: input.is_active !== false,
    allowFraction: Boolean(input.allow_fraction),
    presetQty: normalizePresetQty(input.preset_qty),
  };
}

/** Ganti seluruh daftar satuan jual produk (create/update form). */
export async function replaceProductSellUnits(
  tenantId: string,
  productId: string,
  units: SellUnitInput[],
): Promise<ProductSellUnit[]> {
  const { ensureSellUnitsSchema } = await import("@/server/db/ensure-sell-units-schema");
  await ensureSellUnitsSchema();
  const db = getDb();
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
    .limit(1);
  if (!product) throw new Error("Produk tidak ditemukan");

  await db
    .delete(productSellUnits)
    .where(
      and(eq(productSellUnits.tenantId, tenantId), eq(productSellUnits.productId, productId)),
    );

  if (units.length === 0) return [];

  const values = units.map((u, i) => {
    const s = sanitizeUnitInput(u, i);
    return {
      tenantId,
      productId,
      label: s.label,
      factorToBase: s.factorToBase,
      sellingPrice: s.sellingPrice,
      purchasePrice: s.purchasePrice,
      sortOrder: s.sortOrder,
      isActive: s.isActive,
      allowFraction: s.allowFraction,
      presetQty: s.presetQty,
    };
  });

  const inserted = await db.insert(productSellUnits).values(values).returning();
  return inserted.map(toProductSellUnit);
}

export async function updateProductStockUnit(
  tenantId: string,
  productId: string,
  stockUnit: string | null | undefined,
): Promise<void> {
  const db = getDb();
  const unit = stockUnit?.trim();
  await db
    .update(products)
    .set({
      stockUnit: unit || null,
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));
}

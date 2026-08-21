// =============================================================================
// Products service — Neon/Drizzle (Phase 2)
// =============================================================================

import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ensureSellUnitsSchema } from "@/server/db/ensure-sell-units-schema";
import { ensureStockOwnershipSchema } from "@/server/db/ensure-stock-ownership-schema";
import {
  branchProductsKey,
  branchProductsMultiKey,
  categoriesKey,
} from "@/server/cache/keys";
import {
  CACHE_TTL,
  getCached,
  registerMultiBranchCacheKey,
} from "@/server/cache/redis";
import {
  invalidateBranchProducts,
  invalidateCategories,
} from "@/server/cache/invalidate";
import {
  toBranchProduct,
  toBranchProductWithProduct,
  toProduct,
  toProductCategory,
} from "@/server/db/mappers";
import { branchProducts, productCategories, products } from "@/server/db/schema";
import { listSellUnitsForProducts, replaceProductSellUnits } from "@/server/services/sell-units";
import { stockStr } from "@/server/db/mappers";
import type { SellUnitInput } from "@/lib/product-sell-units";
import type {
  BranchProduct,
  BranchProductUpdate,
  BranchProductWithProduct,
  Product,
  ProductCategory,
  ProductCategoryInsert,
  ProductInsert,
  ProductUpdate,
} from "@/types/database";

export async function listCategories(tenantId: string): Promise<ProductCategory[]> {
  return getCached(categoriesKey(tenantId), CACHE_TTL.categories, async () => {
    const db = getDb();
    const rows = await db.query.productCategories.findMany({
      where: eq(productCategories.tenantId, tenantId),
      orderBy: asc(productCategories.name),
    });
    return rows.map(toProductCategory);
  });
}

export async function createCategory(
  tenantId: string,
  payload: Omit<ProductCategoryInsert, "tenant_id">,
): Promise<ProductCategory> {
  const db = getDb();
  const existing = await db.query.productCategories.findFirst({
    where: and(
      eq(productCategories.tenantId, tenantId),
      eq(productCategories.name, payload.name),
    ),
  });
  if (existing) return toProductCategory(existing);

  const [row] = await db
    .insert(productCategories)
    .values({
      id: payload.id,
      tenantId,
      name: payload.name,
      icon: payload.icon,
    })
    .onConflictDoNothing({ target: [productCategories.tenantId, productCategories.name] })
    .returning();

  if (!row) {
    const again = await db.query.productCategories.findFirst({
      where: and(
        eq(productCategories.tenantId, tenantId),
        eq(productCategories.name, payload.name),
      ),
    });
    if (again) return toProductCategory(again);
    throw new Error("Gagal membuat kategori");
  }

  await invalidateCategories(tenantId);
  return toProductCategory(row);
}

export async function listProducts(
  tenantId: string,
  options?: { activeOnly?: boolean; categoryId?: string; search?: string },
): Promise<Product[]> {
  const db = getDb();
  const conditions = [eq(products.tenantId, tenantId)];
  if (options?.activeOnly) conditions.push(eq(products.isActive, true));
  if (options?.categoryId) conditions.push(eq(products.categoryId, options.categoryId));
  if (options?.search) conditions.push(ilike(products.name, `%${options.search}%`));

  const rows = await db.query.products.findMany({
    where: and(...conditions),
    orderBy: asc(products.name),
  });
  return rows.map(toProduct);
}

export async function getProductById(tenantId: string, productId: string): Promise<Product | null> {
  const db = getDb();
  const row = await db.query.products.findFirst({
    where: and(eq(products.tenantId, tenantId), eq(products.id, productId)),
  });
  return row ? toProduct(row) : null;
}

export async function getProductBySku(tenantId: string, sku: string): Promise<Product | null> {
  const db = getDb();
  const row = await db.query.products.findFirst({
    where: and(eq(products.tenantId, tenantId), eq(products.sku, sku)),
  });
  return row ? toProduct(row) : null;
}

export async function getProductByBarcode(
  tenantId: string,
  barcode: string,
): Promise<Product | null> {
  const db = getDb();
  const row = await db.query.products.findFirst({
    where: and(eq(products.tenantId, tenantId), eq(products.barcode, barcode)),
  });
  return row ? toProduct(row) : null;
}

export async function createProduct(
  tenantId: string,
  payload: Omit<ProductInsert, "tenant_id"> & {
    stock_unit?: string | null;
    sell_units?: SellUnitInput[];
  },
): Promise<Product> {
  await ensureSellUnitsSchema();
  await ensureStockOwnershipSchema();
  const db = getDb();
  const stockUnit = payload.stock_unit?.trim() || payload.unit;
  const [row] = await db
    .insert(products)
    .values({
      id: payload.id,
      tenantId,
      sku: payload.sku,
      barcode: payload.barcode,
      name: payload.name,
      categoryId: payload.category_id,
      unit: payload.unit,
      stockUnit,
      purchasePrice: payload.purchase_price,
      isReturnable: payload.is_returnable ?? true,
      returnBlockLabel: payload.return_block_label ?? null,
      isActive: payload.is_active ?? true,
    })
    .returning();
  const product = toProduct(row);
  if (payload.sell_units?.length) {
    product.sell_units = await replaceProductSellUnits(tenantId, product.id, payload.sell_units);
  } else {
    product.sell_units = [];
  }
  await invalidateBranchProducts(tenantId);
  return product;
}

export async function updateProduct(
  tenantId: string,
  productId: string,
  updates: ProductUpdate & {
    stock_unit?: string | null;
    sell_units?: SellUnitInput[];
  },
): Promise<Product | null> {
  await ensureSellUnitsSchema();
  const db = getDb();
  const patch: Partial<typeof products.$inferInsert> = {};
  if (updates.sku !== undefined) patch.sku = updates.sku;
  if (updates.barcode !== undefined) patch.barcode = updates.barcode;
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.category_id !== undefined) patch.categoryId = updates.category_id;
  if (updates.unit !== undefined) patch.unit = updates.unit;
  if (updates.stock_unit !== undefined) {
    patch.stockUnit = updates.stock_unit?.trim() || null;
  } else if (updates.unit !== undefined) {
    patch.stockUnit = updates.unit;
  }
  if (updates.purchase_price !== undefined) patch.purchasePrice = updates.purchase_price;
  if (updates.is_returnable !== undefined) patch.isReturnable = updates.is_returnable;
  if (updates.return_block_label !== undefined) patch.returnBlockLabel = updates.return_block_label;
  if (updates.is_active !== undefined) patch.isActive = updates.is_active;
  patch.updatedAt = new Date();

  const [row] = await db
    .update(products)
    .set(patch)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .returning();
  if (!row) return null;

  const product = toProduct(row);
  if (updates.sell_units !== undefined) {
    product.sell_units = await replaceProductSellUnits(tenantId, productId, updates.sell_units);
  } else {
    const map = await listSellUnitsForProducts(tenantId, [productId]);
    product.sell_units = map.get(productId) ?? [];
  }
  await invalidateBranchProducts(tenantId);
  return product;
}

async function fetchBranchProductsFromDb(
  tenantId: string,
  branchIds: string[],
): Promise<Record<string, BranchProductWithProduct[]>> {
  await ensureSellUnitsSchema();
  await ensureStockOwnershipSchema();
  const db = getDb();
  const byBranch = Object.fromEntries(branchIds.map((id) => [id, [] as BranchProductWithProduct[]]));
  if (branchIds.length === 0) return byBranch;

  const rows = await db
    .select({
      bp: branchProducts,
      product: products,
      category: productCategories,
    })
    .from(branchProducts)
    .innerJoin(products, eq(branchProducts.productId, products.id))
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(
      and(eq(branchProducts.tenantId, tenantId), inArray(branchProducts.branchId, branchIds)),
    );

  for (const { bp, product, category } of rows) {
    byBranch[bp.branchId]?.push(toBranchProductWithProduct(bp, product, category));
  }

  const productIds = Array.from(new Set(rows.map((r) => r.product.id)));
  const sellUnitsMap = await listSellUnitsForProducts(tenantId, productIds);
  for (const branchId of Object.keys(byBranch)) {
    for (const item of byBranch[branchId] ?? []) {
      item.product.sell_units = sellUnitsMap.get(item.product_id) ?? [];
      if (!item.product.stock_unit) item.product.stock_unit = item.product.unit;
    }
  }

  return byBranch;
}

function filterBranchProducts(
  items: BranchProductWithProduct[],
  options?: { search?: string; lowStockOnly?: boolean },
): BranchProductWithProduct[] {
  let result = items;
  if (options?.search) {
    const q = options.search.toLowerCase();
    result = result.filter(
      (r) =>
        r.product.name.toLowerCase().includes(q) || r.product.sku.toLowerCase().includes(q),
    );
  }
  if (options?.lowStockOnly) {
    result = result.filter((r) => r.stock <= r.reorder_point);
  }
  return result;
}

export async function listBranchProducts(
  tenantId: string,
  branchId: string,
  options?: { search?: string; lowStockOnly?: boolean },
): Promise<BranchProductWithProduct[]> {
  if (options?.search || options?.lowStockOnly) {
    const byBranch = await fetchBranchProductsFromDb(tenantId, [branchId]);
    return filterBranchProducts(byBranch[branchId] ?? [], options);
  }

  return getCached(branchProductsKey(tenantId, branchId), CACHE_TTL.branchProducts, async () => {
    const byBranch = await fetchBranchProductsFromDb(tenantId, [branchId]);
    return byBranch[branchId] ?? [];
  });
}

export async function listBranchProductsForBranches(
  tenantId: string,
  branchIds: string[],
  options?: { search?: string; lowStockOnly?: boolean },
): Promise<Record<string, BranchProductWithProduct[]>> {
  if (branchIds.length === 0) return {};
  if (options?.search || options?.lowStockOnly) {
    const byBranch = await fetchBranchProductsFromDb(tenantId, branchIds);
    return Object.fromEntries(
      Object.entries(byBranch).map(([branchId, items]) => [
        branchId,
        filterBranchProducts(items, options),
      ]),
    );
  }

  const cacheKey = branchProductsMultiKey(tenantId, branchIds);
  registerMultiBranchCacheKey(tenantId, cacheKey);
  return getCached(cacheKey, CACHE_TTL.branchProducts, () =>
    fetchBranchProductsFromDb(tenantId, branchIds),
  );
}

export async function getBranchProduct(
  tenantId: string,
  branchId: string,
  productId: string,
): Promise<BranchProduct | null> {
  const db = getDb();
  const row = await db.query.branchProducts.findFirst({
    where: and(
      eq(branchProducts.tenantId, tenantId),
      eq(branchProducts.branchId, branchId),
      eq(branchProducts.productId, productId),
    ),
  });
  return row ? toBranchProduct(row) : null;
}

export async function upsertBranchProduct(
  tenantId: string,
  branchId: string,
  productId: string,
  payload: Pick<BranchProduct, "selling_price" | "reorder_point" | "warehouse_location"> & {
    stock?: number;
    legacy_stock?: number;
    stock_status?: BranchProduct["stock_status"];
    stock_ownership?: BranchProduct["stock_ownership"];
    consignment_supplier_id?: string | null;
  },
): Promise<BranchProduct> {
  await ensureSellUnitsSchema();
  await ensureStockOwnershipSchema();
  const db = getDb();
  const stock = payload.stock ?? 0;
  const legacyStock = payload.legacy_stock ?? 0;
  const stockStatus =
    payload.stock_status ??
    (stock > 0 ? "unverified" : "new");
  const [row] = await db
    .insert(branchProducts)
    .values({
      tenantId,
      branchId,
      productId,
      sellingPrice: payload.selling_price,
      reorderPoint: payload.reorder_point,
      warehouseLocation: payload.warehouse_location,
      stock: stockStr(stock),
      legacyStock: stockStr(legacyStock),
      stockStatus,
      stockOwnership: payload.stock_ownership ?? "owned",
      consignmentSupplierId: payload.consignment_supplier_id ?? null,
    })
    .onConflictDoUpdate({
      target: [branchProducts.branchId, branchProducts.productId],
      set: {
        sellingPrice: payload.selling_price,
        reorderPoint: payload.reorder_point,
        warehouseLocation: payload.warehouse_location,
        ...(payload.stock !== undefined ? { stock: stockStr(payload.stock) } : {}),
        ...(payload.legacy_stock !== undefined
          ? { legacyStock: stockStr(payload.legacy_stock) }
          : {}),
        ...(payload.stock_status !== undefined ? { stockStatus: payload.stock_status } : {}),
        ...(payload.stock_ownership !== undefined
          ? { stockOwnership: payload.stock_ownership }
          : {}),
        ...(payload.consignment_supplier_id !== undefined
          ? { consignmentSupplierId: payload.consignment_supplier_id }
          : {}),
      },
    })
    .returning();
  await invalidateBranchProducts(tenantId, branchId);
  return toBranchProduct(row);
}

export async function updateBranchProductById(
  tenantId: string,
  branchProductId: string,
  updates: BranchProductUpdate,
): Promise<BranchProduct | null> {
  const db = getDb();
  const patch: Partial<typeof branchProducts.$inferInsert> = {};
  if (updates.selling_price !== undefined) patch.sellingPrice = updates.selling_price;
  if (updates.stock !== undefined) patch.stock = stockStr(updates.stock);
  if (updates.legacy_stock !== undefined) patch.legacyStock = stockStr(updates.legacy_stock);
  if (updates.stock_status !== undefined) patch.stockStatus = updates.stock_status;
  if (updates.stock_ownership !== undefined) patch.stockOwnership = updates.stock_ownership;
  if (updates.consignment_supplier_id !== undefined) {
    patch.consignmentSupplierId = updates.consignment_supplier_id;
  }
  if (updates.reorder_point !== undefined) patch.reorderPoint = updates.reorder_point;
  if (updates.warehouse_location !== undefined) patch.warehouseLocation = updates.warehouse_location;

  const [row] = await db
    .update(branchProducts)
    .set(patch)
    .where(and(eq(branchProducts.tenantId, tenantId), eq(branchProducts.id, branchProductId)))
    .returning();
  if (row) await invalidateBranchProducts(tenantId, row.branchId);
  return row ? toBranchProduct(row) : null;
}

export async function updateSellingPrice(
  tenantId: string,
  branchId: string,
  productId: string,
  sellingPrice: number,
): Promise<BranchProduct | null> {
  const db = getDb();
  const [row] = await db
    .update(branchProducts)
    .set({ sellingPrice })
    .where(
      and(
        eq(branchProducts.tenantId, tenantId),
        eq(branchProducts.branchId, branchId),
        eq(branchProducts.productId, productId),
      ),
    )
    .returning();
  if (row) await invalidateBranchProducts(tenantId, branchId);
  return row ? toBranchProduct(row) : null;
}

export async function listLowStockAlert(
  tenantId: string,
  branchId?: string,
): Promise<BranchProductWithProduct[]> {
  const db = getDb();
  const conditions = [
    eq(branchProducts.tenantId, tenantId),
    sql`${branchProducts.stock} <= ${branchProducts.reorderPoint}`,
  ];
  if (branchId) conditions.push(eq(branchProducts.branchId, branchId));

  const rows = await db
    .select({ bp: branchProducts, product: products, category: productCategories })
    .from(branchProducts)
    .innerJoin(products, eq(branchProducts.productId, products.id))
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(and(...conditions))
    .orderBy(asc(branchProducts.stock));

  return rows.map(({ bp, product, category }) =>
    toBranchProductWithProduct(bp, product, category),
  );
}

export async function ensureCategory(
  tenantId: string,
  name: string,
): Promise<ProductCategory> {
  const db = getDb();
  const existing = await db.query.productCategories.findFirst({
    where: and(eq(productCategories.tenantId, tenantId), eq(productCategories.name, name)),
  });
  if (existing) return toProductCategory(existing);

  const [row] = await db
    .insert(productCategories)
    .values({ tenantId, name, icon: null })
    .returning();
  await invalidateCategories(tenantId);
  return toProductCategory(row);
}

export async function ensureBranchProductRow(
  tenantId: string,
  branchId: string,
  productId: string,
  data: {
    sellingPrice: number;
    stock: number;
    legacyStock: number;
    reorderPoint?: number;
    warehouseLocation?: string | null;
    stockStatus?: BranchProduct["stock_status"];
    stockOwnership?: BranchProduct["stock_ownership"];
    consignmentSupplierId?: string | null;
  },
): Promise<BranchProduct> {
  await ensureSellUnitsSchema();
  await ensureStockOwnershipSchema();
  const db = getDb();
  const stockStatus =
    data.stockStatus ?? (data.stock > 0 ? "unverified" : "new");
  const [row] = await db
    .insert(branchProducts)
    .values({
      tenantId,
      branchId,
      productId,
      sellingPrice: data.sellingPrice,
      stock: stockStr(data.stock),
      legacyStock: stockStr(data.legacyStock),
      stockStatus,
      stockOwnership: data.stockOwnership ?? "owned",
      consignmentSupplierId: data.consignmentSupplierId ?? null,
      reorderPoint: data.reorderPoint ?? 5,
      warehouseLocation: data.warehouseLocation?.trim() || null,
    })
    .onConflictDoUpdate({
      target: [branchProducts.branchId, branchProducts.productId],
      set: {
        sellingPrice: data.sellingPrice,
        stock: stockStr(data.stock),
        legacyStock: stockStr(data.legacyStock),
        stockStatus,
        stockOwnership: data.stockOwnership ?? "owned",
        consignmentSupplierId: data.consignmentSupplierId ?? null,
        reorderPoint: data.reorderPoint ?? 5,
        warehouseLocation: data.warehouseLocation?.trim() || null,
      },
    })
    .returning();
  await invalidateBranchProducts(tenantId, branchId);
  return toBranchProduct(row);
}

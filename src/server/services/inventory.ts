// =============================================================================
// Inventory service — Neon/Drizzle (Phase 2 partial)
// =============================================================================

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/server/db";
import { invalidateBranchProducts } from "@/server/cache/invalidate";
import { toBranchProduct, toStockMovement } from "@/server/db/mappers";
import { branchProducts, stockMovements } from "@/server/db/schema";
import type { BranchProduct, StockMovement, StockMovementInsert } from "@/types/database";
import type { DateRangeFilter } from "@/types/app";

export async function listStockMovements(
  tenantId: string,
  branchId: string,
  options?: {
    productId?: string;
    dateRange?: DateRangeFilter;
    type?: StockMovement["type"];
    limit?: number;
  },
): Promise<StockMovement[]> {
  const db = getDb();
  const conditions = [
    eq(stockMovements.tenantId, tenantId),
    eq(stockMovements.branchId, branchId),
  ];
  if (options?.productId) conditions.push(eq(stockMovements.productId, options.productId));
  if (options?.type) conditions.push(eq(stockMovements.type, options.type));
  if (options?.dateRange?.from) {
    conditions.push(gte(stockMovements.createdAt, new Date(options.dateRange.from)));
  }
  if (options?.dateRange?.to) {
    conditions.push(lte(stockMovements.createdAt, new Date(options.dateRange.to)));
  }

  const rows = await db.query.stockMovements.findMany({
    where: and(...conditions),
    orderBy: desc(stockMovements.createdAt),
    limit: options?.limit,
  });
  return rows.map(toStockMovement);
}

export async function insertStockMovement(
  tenantId: string,
  movement: Omit<StockMovementInsert, "tenant_id">,
): Promise<StockMovement> {
  const db = getDb();
  const [row] = await db
    .insert(stockMovements)
    .values({
      tenantId,
      branchId: movement.branch_id,
      productId: movement.product_id,
      type: movement.type,
      stockSource: movement.stock_source,
      qty: movement.qty,
      qtyBefore: movement.qty_before,
      qtyAfter: movement.qty_after,
      reference: movement.reference,
      notes: movement.notes,
      userId: movement.user_id,
    })
    .returning();
  return toStockMovement(row);
}

export async function adjustStock(
  tenantId: string,
  branchId: string,
  productId: string,
  delta: number,
  type: StockMovement["type"],
  options?: {
    stockSource?: "verified" | "legacy";
    reference?: string;
    notes?: string;
    userId?: string;
  },
): Promise<BranchProduct> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const bp = await tx.query.branchProducts.findFirst({
      where: and(
        eq(branchProducts.tenantId, tenantId),
        eq(branchProducts.branchId, branchId),
        eq(branchProducts.productId, productId),
      ),
    });
    if (!bp) throw new Error("Produk cabang tidak ditemukan");

    const source = options?.stockSource ?? "verified";
    const isLegacy = source === "legacy";
    const currentQty = isLegacy ? bp.legacyStock : bp.stock;
    const newQty = Math.max(0, currentQty + delta);

    const [updated] = await tx
      .update(branchProducts)
      .set(isLegacy ? { legacyStock: newQty } : { stock: newQty })
      .where(eq(branchProducts.id, bp.id))
      .returning();

    await tx.insert(stockMovements).values({
      tenantId,
      branchId,
      productId,
      type,
      stockSource: source,
      qty: Math.abs(delta),
      qtyBefore: currentQty,
      qtyAfter: newQty,
      reference: options?.reference ?? null,
      notes: options?.notes ?? null,
      userId: options?.userId ?? null,
    });

    await invalidateBranchProducts(tenantId, branchId);
    return toBranchProduct(updated);
  });
}

// =============================================================================
// Transfers & opname service — inventory Phase 5
// =============================================================================

import { and, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { invalidateBranchProducts } from "@/server/cache/invalidate";
import {
  toStockMovement,
  toStockTransfer,
  toStockTransferItem,
  stockStr,
} from "@/server/db/mappers";
import {
  branchProducts,
  branches,
  products,
  stockMovements,
  stockTransferItems,
  stockTransfers,
} from "@/server/db/schema";
import { ensureStockOwnershipSchema } from "@/server/db/ensure-stock-ownership-schema";
import { nextDocNumberForTable } from "@/server/services/doc-numbers";
import type { DateRangeFilter } from "@/types/app";
import type {
  OpnameItem,
  StockMovement,
  StockTransfer,
  StockTransferInsert,
  StockTransferItem,
  StockTransferItemInsert,
} from "@/types/database";

export async function submitOpnameRecord(
  tenantId: string,
  branchId: string,
  userId: string,
  reference: string,
  items: OpnameItem[],
): Promise<StockMovement[]> {
  await ensureStockOwnershipSchema();
  const db = getDb();
  const results: StockMovement[] = [];

  await db.transaction(async (tx) => {
    for (const item of items) {
      const bp = await tx.query.branchProducts.findFirst({
        where: and(
          eq(branchProducts.tenantId, tenantId),
          eq(branchProducts.branchId, branchId),
          eq(branchProducts.productId, item.product_id),
        ),
      });
      if (!bp) continue;

      const isLegacy = item.stock_source === "legacy";

      await tx
        .update(branchProducts)
        .set({
          ...(isLegacy
            ? { legacyStock: stockStr(item.actual_stock) }
            : { stock: stockStr(item.actual_stock) }),
          stockStatus: "verified",
        })
        .where(eq(branchProducts.id, bp.id));

      if (item.discrepancy === 0) continue;

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          tenantId,
          branchId,
          productId: item.product_id,
          type: "opname",
          stockSource: item.stock_source,
          qty: stockStr(Math.abs(item.discrepancy)),
          qtyBefore: stockStr(item.system_stock),
          qtyAfter: stockStr(item.actual_stock),
          reference,
          notes: item.notes,
          userId,
        })
        .returning();

      results.push(toStockMovement(movement));
    }
  });

  await invalidateBranchProducts(tenantId, branchId);
  return results;
}

export interface OpnameVarianceReportRow {
  id: string;
  reference: string;
  branchId: string;
  productName: string;
  sku: string;
  systemQty: number;
  physicalQty: number;
  variance: number;
  unitCost: number;
  estimatedLoss: number;
  date: string;
}

export async function getOpnameVarianceReport(
  tenantId: string,
  branchIds: string[],
  dateRange: DateRangeFilter,
): Promise<OpnameVarianceReportRow[]> {
  if (branchIds.length === 0) return [];

  const db = getDb();
  const conditions = [
    eq(stockMovements.tenantId, tenantId),
    eq(stockMovements.type, "opname"),
    inArray(stockMovements.branchId, branchIds),
  ];
  if (dateRange.from) {
    conditions.push(gte(stockMovements.createdAt, new Date(dateRange.from)));
  }
  if (dateRange.to) {
    conditions.push(lte(stockMovements.createdAt, new Date(dateRange.to)));
  }

  const rows = await db
    .select({
      movement: stockMovements,
      sku: products.sku,
      productName: products.name,
      purchasePrice: products.purchasePrice,
    })
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .where(and(...conditions))
    .orderBy(desc(stockMovements.createdAt));

  return rows.map(({ movement, sku, productName, purchasePrice }) => {
    const variance = movement.qtyAfter - movement.qtyBefore;
    const unitCost = purchasePrice ?? 0;
    const estimatedLoss = variance < 0 ? Math.abs(variance) * unitCost : 0;
    return {
      id: movement.id,
      reference: movement.reference ?? "",
      branchId: movement.branchId,
      productName,
      sku,
      systemQty: movement.qtyBefore,
      physicalQty: movement.qtyAfter,
      variance,
      unitCost,
      estimatedLoss,
      date: movement.createdAt.toISOString(),
    };
  });
}

export async function listStockTransfers(
  tenantId: string,
  branchId?: string,
  options?: { status?: StockTransfer["status"]; dateRange?: DateRangeFilter },
): Promise<
  (StockTransfer & {
    items: StockTransferItem[];
    from_branch?: { name: string };
    to_branch?: { name: string };
  })[]
> {
  const db = getDb();
  const conditions = [eq(stockTransfers.tenantId, tenantId)];
  if (branchId) {
    conditions.push(
      or(
        eq(stockTransfers.fromBranchId, branchId),
        eq(stockTransfers.toBranchId, branchId),
      )!,
    );
  }
  if (options?.status) conditions.push(eq(stockTransfers.status, options.status));
  if (options?.dateRange?.from) {
    conditions.push(gte(stockTransfers.createdAt, new Date(options.dateRange.from)));
  }
  if (options?.dateRange?.to) {
    conditions.push(lte(stockTransfers.createdAt, new Date(options.dateRange.to)));
  }

  const rows = await db.query.stockTransfers.findMany({
    where: and(...conditions),
    orderBy: desc(stockTransfers.createdAt),
  });

  const branchRows = await db.query.branches.findMany({
    where: eq(branches.tenantId, tenantId),
  });
  const branchMap = new Map(branchRows.map((b) => [b.id, b.name]));

  const result: (StockTransfer & {
    items: StockTransferItem[];
    from_branch?: { name: string };
    to_branch?: { name: string };
  })[] = [];

  for (const row of rows) {
    const itemRows = await db.query.stockTransferItems.findMany({
      where: eq(stockTransferItems.transferId, row.id),
    });
    result.push({
      ...toStockTransfer(row),
      items: itemRows.map(toStockTransferItem),
      from_branch: { name: branchMap.get(row.fromBranchId) ?? "" },
      to_branch: { name: branchMap.get(row.toBranchId) ?? "" },
    });
  }

  return result;
}

export async function getStockTransferById(
  tenantId: string,
  transferId: string,
): Promise<(StockTransfer & { items: StockTransferItem[] }) | null> {
  const list = await listStockTransfers(tenantId);
  const found = list.find((t) => t.id === transferId);
  if (!found) return null;
  return { ...found, items: found.items };
}

export async function createStockTransferRecord(
  tenantId: string,
  transfer: Omit<StockTransferInsert, "tenant_id">,
  items: Omit<StockTransferItemInsert, "transfer_id" | "tenant_id">[],
): Promise<StockTransfer> {
  const db = getDb();
  const transferNumber =
    transfer.transfer_number ||
    (await nextDocNumberForTable(
      db,
      stockTransfers,
      stockTransfers.tenantId,
      stockTransfers.transferNumber,
      tenantId,
      "TRF",
    ));

  return db.transaction(async (tx) => {
    const [tfRow] = await tx
      .insert(stockTransfers)
      .values({
        tenantId,
        transferNumber,
        fromBranchId: transfer.from_branch_id,
        toBranchId: transfer.to_branch_id,
        status: transfer.status ?? "draft",
        notes: transfer.notes,
        createdBy: transfer.created_by,
        confirmedBy: transfer.confirmed_by,
        sentAt: transfer.sent_at ? new Date(transfer.sent_at) : null,
        receivedAt: transfer.received_at ? new Date(transfer.received_at) : null,
      })
      .returning();

    if (items.length > 0) {
      await tx.insert(stockTransferItems).values(
        items.map((item) => ({
          transferId: tfRow.id,
          tenantId,
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          unit: item.unit,
          requestedQty: item.requested_qty,
          sentQty: item.sent_qty,
          receivedQty: item.received_qty ?? 0,
        })),
      );
    }

    return toStockTransfer(tfRow);
  });
}

async function adjustStockInTx(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  tenantId: string,
  branchId: string,
  productId: string,
  delta: number,
  type: StockMovement["type"],
  options: { reference?: string; notes?: string; userId?: string },
): Promise<void> {
  const bp = await tx.query.branchProducts.findFirst({
    where: and(
      eq(branchProducts.tenantId, tenantId),
      eq(branchProducts.branchId, branchId),
      eq(branchProducts.productId, productId),
    ),
  });
  if (!bp) throw new Error("Produk cabang tidak ditemukan");

  const currentQty = bp.stock;
  const newQty = Math.max(0, currentQty + delta);

  await tx.update(branchProducts).set({ stock: newQty }).where(eq(branchProducts.id, bp.id));
  await tx.insert(stockMovements).values({
    tenantId,
    branchId,
    productId,
    type,
    stockSource: "verified",
    qty: Math.abs(delta),
    qtyBefore: currentQty,
    qtyAfter: newQty,
    reference: options.reference ?? null,
    notes: options.notes ?? null,
    userId: options.userId ?? null,
  });
}

export async function sendStockTransferRecord(
  tenantId: string,
  transferId: string,
  userId: string,
): Promise<StockTransfer | null> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const tf = await tx.query.stockTransfers.findFirst({
      where: and(eq(stockTransfers.tenantId, tenantId), eq(stockTransfers.id, transferId)),
    });
    if (!tf) throw new Error("Transfer tidak ditemukan");
    if (tf.status !== "draft") throw new Error("Transfer sudah dikirim atau dibatalkan");

    const items = await tx.query.stockTransferItems.findMany({
      where: eq(stockTransferItems.transferId, transferId),
    });

    for (const item of items) {
      await adjustStockInTx(
        tx,
        tenantId,
        tf.fromBranchId,
        item.productId,
        -item.sentQty,
        "transfer_out",
        { reference: tf.transferNumber, userId },
      );
    }

    const [updated] = await tx
      .update(stockTransfers)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(stockTransfers.id, transferId))
      .returning();

    return updated ? toStockTransfer(updated) : null;
  });
}

export async function confirmStockTransferReceivedRecord(
  tenantId: string,
  transferId: string,
  userId: string,
  receivedQties: Record<string, number>,
): Promise<StockTransfer | null> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const tf = await tx.query.stockTransfers.findFirst({
      where: and(eq(stockTransfers.tenantId, tenantId), eq(stockTransfers.id, transferId)),
    });
    if (!tf) throw new Error("Transfer tidak ditemukan");
    if (tf.status !== "sent") throw new Error("Transfer belum dikirim");

    const items = await tx.query.stockTransferItems.findMany({
      where: eq(stockTransferItems.transferId, transferId),
    });

    for (const item of items) {
      const qty = receivedQties[item.id] ?? item.sentQty;
      await tx
        .update(stockTransferItems)
        .set({ receivedQty: qty })
        .where(eq(stockTransferItems.id, item.id));

      await adjustStockInTx(
        tx,
        tenantId,
        tf.toBranchId,
        item.productId,
        qty,
        "transfer_in",
        { reference: tf.transferNumber, userId },
      );
    }

    const [updated] = await tx
      .update(stockTransfers)
      .set({ status: "received", receivedAt: new Date(), confirmedBy: userId })
      .where(eq(stockTransfers.id, transferId))
      .returning();

    return updated ? toStockTransfer(updated) : null;
  });
}

export async function cancelStockTransferRecord(
  tenantId: string,
  transferId: string,
  userId: string,
): Promise<StockTransfer | null> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const tf = await tx.query.stockTransfers.findFirst({
      where: and(eq(stockTransfers.tenantId, tenantId), eq(stockTransfers.id, transferId)),
    });
    if (!tf) throw new Error("Transfer tidak ditemukan");

    if (tf.status === "sent") {
      const items = await tx.query.stockTransferItems.findMany({
        where: eq(stockTransferItems.transferId, transferId),
      });
      for (const item of items) {
        await adjustStockInTx(tx, tenantId, tf.fromBranchId, item.productId, item.sentQty, "in", {
          reference: tf.transferNumber,
          notes: "Transfer dibatalkan — stok dikembalikan",
          userId,
        });
      }
    }

    const [updated] = await tx
      .update(stockTransfers)
      .set({ status: "cancelled" })
      .where(eq(stockTransfers.id, transferId))
      .returning();

    return updated ? toStockTransfer(updated) : null;
  });
}

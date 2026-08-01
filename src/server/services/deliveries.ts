// =============================================================================
// Deliveries service — Neon DB (POS checkout → deliveries table)
// =============================================================================

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { branches, deliveries, salesItems, salesTransactions } from "@/server/db/schema";
import type { DeliveryRecord, DeliveryStatus, UpdateDeliveryDraft } from "@/types/deliveries";

export async function listDeliveriesForBranches(
  tenantId: string,
  branchIds: string[],
): Promise<DeliveryRecord[]> {
  if (branchIds.length === 0) return [];

  const db = getDb();
  const rows = await db
    .select({
      delivery: deliveries,
      branchName: branches.name,
      txNumber: salesTransactions.transactionNumber,
      paymentMethod: salesTransactions.paymentMethod,
    })
    .from(deliveries)
    .innerJoin(branches, eq(deliveries.branchId, branches.id))
    .leftJoin(salesTransactions, eq(deliveries.salesTransactionId, salesTransactions.id))
    .where(and(eq(deliveries.tenantId, tenantId), inArray(deliveries.branchId, branchIds)))
    .orderBy(desc(deliveries.createdAt));

  const txIds = rows
    .map((r) => r.delivery.salesTransactionId)
    .filter((id): id is string => Boolean(id));

  const itemsByTx = new Map<string, (typeof salesItems.$inferSelect)[]>();
  if (txIds.length > 0) {
    const itemRows = await db.query.salesItems.findMany({
      where: inArray(salesItems.transactionId, txIds),
    });
    for (const item of itemRows) {
      const list = itemsByTx.get(item.transactionId) ?? [];
      list.push(item);
      itemsByTx.set(item.transactionId, list);
    }
  }

  return rows.map(({ delivery, branchName, txNumber, paymentMethod }) => {
    const txItems = delivery.salesTransactionId
      ? (itemsByTx.get(delivery.salesTransactionId) ?? [])
      : [];

    return {
      id: delivery.id,
      tenantId: delivery.tenantId,
      branchId: delivery.branchId,
      branchName,
      deliveryNumber: delivery.deliveryNumber,
      salesTransactionId: delivery.salesTransactionId ?? "",
      transactionNumber: txNumber ?? "—",
      orderFulfillmentType: "shipped",
      createdAt: delivery.createdAt.toISOString(),
      customerName: delivery.customerName,
      customerPhone: null,
      deliveryAddress: delivery.deliveryAddress ?? "",
      deliverySiteId: null,
      deliverySiteLabel: null,
      cashierId: "",
      cashierName: "—",
      paymentMethod: paymentMethod ?? "cash",
      grandTotal: delivery.grandTotal,
      status: delivery.status as DeliveryStatus,
      scheduledDate: null,
      driverName: null,
      vehiclePlate: null,
      deliveredAt: null,
      notes: null,
      isOfflineSale: false,
      items: txItems.map((item, idx) => ({
        id: `${delivery.deliveryNumber}-line-${idx}`,
        productId: item.productId ?? "",
        productName: item.productName,
        sku: item.sku,
        unit: item.unit,
        qtyOrdered: item.qty,
        qtyToDeliver: item.qty,
        qtyDelivered: delivery.status === "delivered" ? item.qty : 0,
      })),
    };
  });
}

export async function updateDeliveryById(
  tenantId: string,
  deliveryId: string,
  patch: UpdateDeliveryDraft,
): Promise<DeliveryRecord | null> {
  const db = getDb();
  const patchDb: Partial<typeof deliveries.$inferInsert> = {};
  if (patch.status !== undefined) patchDb.status = patch.status;

  const [row] = await db
    .update(deliveries)
    .set({ ...patchDb, updatedAt: new Date() })
    .where(and(eq(deliveries.tenantId, tenantId), eq(deliveries.id, deliveryId)))
    .returning();

  if (!row) return null;

  const all = await listDeliveriesForBranches(tenantId, [row.branchId]);
  return all.find((d) => d.id === deliveryId) ?? null;
}

// =============================================================================
// Sales orders service — SO + fulfillment (Phase 5)
// =============================================================================

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  toSalesOrder,
  toSalesOrderItem,
  toSoFulfillment,
} from "@/server/db/mappers";
import {
  branchProducts,
  purchaseOrderItems,
  purchaseOrders,
  salesOrderItems,
  salesOrders,
  soFulfillments,
  stockMovements,
} from "@/server/db/schema";
import { createReceivable } from "@/server/services/receivables";
import { nextDocNumberForTable } from "@/server/services/doc-numbers";
import type {
  SalesOrder,
  SalesOrderInsert,
  SalesOrderItem,
  SalesOrderItemInsert,
  SalesOrderUpdate,
  SoFulfillment,
  SoFulfillmentInsert,
} from "@/types/database";

function computeItemStatus(item: SalesOrderItem): SalesOrderItem["status"] {
  if (item.delivered_qty >= item.qty) return "fulfilled";
  if (item.delivered_qty > 0) return "partial";
  return "pending";
}

function computeSoStatus(items: SalesOrderItem[]): SalesOrder["status"] {
  if (items.every((i) => i.status === "fulfilled")) return "completed";
  if (items.some((i) => i.delivered_qty > 0)) return "partial_delivered";
  return "confirmed";
}

export async function listSalesOrders(
  tenantId: string,
  branchId?: string,
  options?: { status?: SalesOrder["status"]; customerId?: string },
): Promise<
  (SalesOrder & {
    items: (SalesOrderItem & { fulfillments?: SoFulfillment[] })[];
    customer?: { name: string; phone: string | null };
  })[]
> {
  const db = getDb();
  const conditions = [eq(salesOrders.tenantId, tenantId)];
  if (branchId) conditions.push(eq(salesOrders.branchId, branchId));
  if (options?.status) conditions.push(eq(salesOrders.status, options.status));
  if (options?.customerId) conditions.push(eq(salesOrders.customerId, options.customerId));

  const rows = await db.query.salesOrders.findMany({
    where: and(...conditions),
    orderBy: desc(salesOrders.createdAt),
  });

  const soIds = rows.map((r) => r.id);
  const itemRows =
    soIds.length > 0
      ? await db.query.salesOrderItems.findMany({
          where: inArray(salesOrderItems.soId, soIds),
        })
      : [];

  const itemIds = itemRows.map((i) => i.id);
  const fulfillmentRows =
    itemIds.length > 0
      ? await db.query.soFulfillments.findMany({
          where: inArray(soFulfillments.soItemId, itemIds),
        })
      : [];

  const fulfillmentsByItem = new Map<string, SoFulfillment[]>();
  for (const f of fulfillmentRows) {
    const list = fulfillmentsByItem.get(f.soItemId) ?? [];
    list.push(toSoFulfillment(f));
    fulfillmentsByItem.set(f.soItemId, list);
  }

  const itemsBySo = new Map<string, (SalesOrderItem & { fulfillments?: SoFulfillment[] })[]>();
  for (const row of itemRows) {
    const item = toSalesOrderItem(row);
    const list = itemsBySo.get(row.soId) ?? [];
    list.push({ ...item, fulfillments: fulfillmentsByItem.get(row.id) ?? [] });
    itemsBySo.set(row.soId, list);
  }

  return rows.map((row) => ({
    ...toSalesOrder(row),
    items: itemsBySo.get(row.id) ?? [],
    customer: { name: row.customerName, phone: null },
  }));
}

export async function getSalesOrderById(
  tenantId: string,
  soId: string,
): Promise<
  (SalesOrder & {
    items: (SalesOrderItem & { fulfillments?: SoFulfillment[] })[];
    customer?: { name: string; phone: string | null };
  }) | null
> {
  const orders = await listSalesOrders(tenantId);
  return orders.find((o) => o.id === soId) ?? null;
}

export async function createSalesOrderRecord(
  tenantId: string,
  so: Omit<SalesOrderInsert, "tenant_id">,
  items: Omit<SalesOrderItemInsert, "so_id" | "tenant_id">[],
): Promise<SalesOrder> {
  const db = getDb();
  const soNumber =
    so.so_number ||
    (await nextDocNumberForTable(
      db,
      salesOrders,
      salesOrders.tenantId,
      salesOrders.soNumber,
      tenantId,
      "SO",
    ));

  return db.transaction(async (tx) => {
    const [soRow] = await tx
      .insert(salesOrders)
      .values({
        tenantId,
        branchId: so.branch_id,
        soNumber,
        customerId: so.customer_id,
        customerName: so.customer_name,
        deliveryAddress: so.delivery_address,
        subtotal: so.subtotal,
        discountAmount: so.discount_amount,
        grandTotal: so.grand_total,
        downPayment: so.down_payment,
        status: so.status ?? "draft",
        paymentStatus: so.payment_status ?? "unpaid",
        estimatedDeliveryDate: so.estimated_delivery_date,
        notes: so.notes,
        createdBy: so.created_by,
      })
      .returning();

    if (items.length > 0) {
      await tx.insert(salesOrderItems).values(
        items.map((item) => ({
          soId: soRow.id,
          tenantId,
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          unit: item.unit,
          qty: item.qty,
          sellingPrice: item.selling_price,
          discount: item.discount,
          subtotal: item.subtotal,
          deliveredQty: item.delivered_qty ?? 0,
          status: item.status ?? "pending",
        })),
      );
    }

    return toSalesOrder(soRow);
  });
}

export async function updateSalesOrderById(
  tenantId: string,
  soId: string,
  updates: SalesOrderUpdate,
): Promise<SalesOrder | null> {
  const db = getDb();
  const patch: Partial<typeof salesOrders.$inferInsert> = {};
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.payment_status !== undefined) patch.paymentStatus = updates.payment_status;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.down_payment !== undefined) patch.downPayment = updates.down_payment;
  if (updates.estimated_delivery_date !== undefined) {
    patch.estimatedDeliveryDate = updates.estimated_delivery_date;
  }

  const [row] = await db
    .update(salesOrders)
    .set(patch)
    .where(and(eq(salesOrders.tenantId, tenantId), eq(salesOrders.id, soId)))
    .returning();
  return row ? toSalesOrder(row) : null;
}

export async function addDownPaymentToSo(
  tenantId: string,
  soId: string,
  amount: number,
): Promise<SalesOrder | null> {
  const db = getDb();
  const so = await db.query.salesOrders.findFirst({
    where: and(eq(salesOrders.tenantId, tenantId), eq(salesOrders.id, soId)),
  });
  if (!so) return null;

  const newDownPayment = so.downPayment + amount;
  const paymentStatus =
    newDownPayment >= so.grandTotal ? "paid" : newDownPayment > 0 ? "partial" : "unpaid";

  return updateSalesOrderById(tenantId, soId, {
    down_payment: newDownPayment,
    payment_status: paymentStatus,
  });
}

export async function createFulfillmentRecord(
  tenantId: string,
  soItemId: string,
  payload: Omit<SoFulfillmentInsert, "tenant_id" | "so_item_id">,
): Promise<SoFulfillment> {
  const db = getDb();
  const [row] = await db
    .insert(soFulfillments)
    .values({
      soItemId,
      tenantId,
      source: payload.source,
      qty: payload.qty,
      purchaseOrderId: payload.purchase_order_id,
      supplierId: payload.supplier_id,
      purchasePriceAtTime: payload.purchase_price_at_time,
      status: payload.status ?? "planned",
    })
    .returning();
  return toSoFulfillment(row);
}

export async function listFulfillmentsByItemId(
  tenantId: string,
  soItemId: string,
): Promise<SoFulfillment[]> {
  const db = getDb();
  const rows = await db.query.soFulfillments.findMany({
    where: and(eq(soFulfillments.tenantId, tenantId), eq(soFulfillments.soItemId, soItemId)),
  });
  return rows.map(toSoFulfillment);
}

export async function updateFulfillmentStatusById(
  tenantId: string,
  fulfillmentId: string,
  status: SoFulfillment["status"],
): Promise<SoFulfillment | null> {
  const db = getDb();
  const [row] = await db
    .update(soFulfillments)
    .set({ status })
    .where(and(eq(soFulfillments.tenantId, tenantId), eq(soFulfillments.id, fulfillmentId)))
    .returning();
  return row ? toSoFulfillment(row) : null;
}

export async function processItemFulfillment(
  tenantId: string,
  soId: string,
  soItemId: string,
  stockQty: number,
  indentQty: number,
  userId: string,
  supplierId?: string,
): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    const order = await tx.query.salesOrders.findFirst({
      where: and(eq(salesOrders.tenantId, tenantId), eq(salesOrders.id, soId)),
    });
    if (!order) throw new Error("Sales Order tidak ditemukan");
    if (order.status === "draft" || order.status === "cancelled") {
      throw new Error("Konfirmasi SO terlebih dahulu");
    }

    const itemRow = await tx.query.salesOrderItems.findFirst({
      where: and(eq(salesOrderItems.id, soItemId), eq(salesOrderItems.soId, soId)),
    });
    if (!itemRow) throw new Error("Item tidak ditemukan");

    const item = toSalesOrderItem(itemRow);
    const remaining = item.qty - item.delivered_qty;
    const totalFulfill = stockQty + indentQty;
    if (totalFulfill <= 0) throw new Error("Qty fulfillment minimal 1");
    if (totalFulfill > remaining) throw new Error(`Maksimal ${remaining} unit tersisa`);
    if (indentQty > 0 && !supplierId) throw new Error("Pilih supplier untuk item indent");

    if (stockQty > 0 && item.product_id) {
      const bp = await tx.query.branchProducts.findFirst({
        where: and(
          eq(branchProducts.tenantId, tenantId),
          eq(branchProducts.branchId, order.branchId),
          eq(branchProducts.productId, item.product_id),
        ),
      });
      if (!bp || bp.stock < stockQty) throw new Error(`Stok tidak cukup untuk ${item.sku}`);

      const newQty = bp.stock - stockQty;
      await tx.update(branchProducts).set({ stock: newQty }).where(eq(branchProducts.id, bp.id));
      await tx.insert(stockMovements).values({
        tenantId,
        branchId: order.branchId,
        productId: item.product_id,
        type: "out",
        stockSource: "verified",
        qty: stockQty,
        qtyBefore: bp.stock,
        qtyAfter: newQty,
        reference: order.soNumber,
        notes: "Fulfillment SO dari stok",
        userId,
      });

      await tx.insert(soFulfillments).values({
        soItemId,
        tenantId,
        source: "stock",
        qty: stockQty,
        purchasePriceAtTime: 0,
        status: "delivered",
      });
    }

    if (indentQty > 0 && supplierId) {
      const prefix = "PO-IND";
      const poNumber = await nextDocNumberForTable(
        tx as unknown as ReturnType<typeof getDb>,
        purchaseOrders,
        purchaseOrders.tenantId,
        purchaseOrders.poNumber,
        tenantId,
        prefix,
      );

      const purchasePrice = item.selling_price;
      const subtotal = indentQty * purchasePrice;

      const [poRow] = await tx
        .insert(purchaseOrders)
        .values({
          tenantId,
          branchId: order.branchId,
          poNumber,
          type: "indent",
          salesOrderId: soId,
          supplierId,
          deliveryAddress: order.deliveryAddress,
          subtotal,
          grandTotal: subtotal,
          status: "draft",
          createdBy: userId,
        })
        .returning();

      await tx.insert(purchaseOrderItems).values({
        poId: poRow.id,
        tenantId,
        productId: item.product_id,
        productName: item.product_name,
        sku: item.sku,
        unit: item.unit,
        orderedQty: indentQty,
        receivedQty: 0,
        purchasePrice,
        subtotal,
      });

      await tx.insert(soFulfillments).values({
        soItemId,
        tenantId,
        source: "indent",
        qty: indentQty,
        purchaseOrderId: poRow.id,
        supplierId,
        purchasePriceAtTime: purchasePrice,
        status: "planned",
      });
    }

    const newDelivered = item.delivered_qty + totalFulfill;
    const updatedItem: SalesOrderItem = {
      ...item,
      delivered_qty: newDelivered,
      status: computeItemStatus({ ...item, delivered_qty: newDelivered }),
    };

    await tx
      .update(salesOrderItems)
      .set({ deliveredQty: updatedItem.delivered_qty, status: updatedItem.status })
      .where(eq(salesOrderItems.id, soItemId));

    const allItems = await tx.query.salesOrderItems.findMany({
      where: eq(salesOrderItems.soId, soId),
    });
    const mapped = allItems.map((r) =>
      r.id === soItemId ? updatedItem : toSalesOrderItem(r),
    );
    const soStatus = computeSoStatus(mapped);

    await tx.update(salesOrders).set({ status: soStatus }).where(eq(salesOrders.id, soId));
  });
}

export async function convertSalesOrderToInvoice(
  tenantId: string,
  soId: string,
): Promise<{ invoiceNumber: string }> {
  const db = getDb();
  const order = await db.query.salesOrders.findFirst({
    where: and(eq(salesOrders.tenantId, tenantId), eq(salesOrders.id, soId)),
  });
  if (!order) throw new Error("Sales Order tidak ditemukan");
  if (order.status !== "completed") {
    throw new Error("SO belum selesai — selesaikan fulfillment dulu");
  }
  if (!order.customerId) {
    throw new Error("SO tidak punya pelanggan terdaftar");
  }

  const invoiceNumber = `INV-${order.soNumber}`;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  await createReceivable(tenantId, {
    branch_id: order.branchId,
    invoice_number: invoiceNumber,
    customer_id: order.customerId,
    customer_name: order.customerName,
    sales_order_id: soId,
    total_amount: order.grandTotal - order.downPayment,
    paid_amount: 0,
    due_date: dueDate.toISOString().slice(0, 10),
    status: "unpaid",
  });

  return { invoiceNumber };
}

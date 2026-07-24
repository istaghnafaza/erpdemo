// =============================================================================
// Purchasing service — suppliers, PO, GRN (Phase 5)
// =============================================================================

import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  toGoodsReceipt,
  toGrItem,
  toPoItem,
  toPurchaseOrder,
  toSupplier,
} from "@/server/db/mappers";
import {
  branchProducts,
  goodsReceiptItems,
  goodsReceipts,
  purchaseOrderItems,
  purchaseOrders,
  stockMovements,
  suppliers,
} from "@/server/db/schema";
import { nextDocNumberForTable } from "@/server/services/doc-numbers";
import type {
  GoodsReceipt,
  GoodsReceiptInsert,
  GrItem,
  GrItemInsert,
  PoItem,
  PoItemInsert,
  PurchaseOrder,
  PurchaseOrderInsert,
  PurchaseOrderUpdate,
  Supplier,
  SupplierInsert,
  SupplierUpdate,
} from "@/types/database";

export async function listSuppliers(
  tenantId: string,
  options?: { activeOnly?: boolean; search?: string },
): Promise<Supplier[]> {
  const db = getDb();
  const conditions = [eq(suppliers.tenantId, tenantId)];
  if (options?.activeOnly) conditions.push(eq(suppliers.isActive, true));
  if (options?.search) conditions.push(ilike(suppliers.name, `%${options.search}%`));

  const rows = await db.query.suppliers.findMany({
    where: and(...conditions),
    orderBy: [suppliers.name],
  });
  return rows.map(toSupplier);
}

export async function getSupplierById(
  tenantId: string,
  supplierId: string,
): Promise<Supplier | null> {
  const db = getDb();
  const row = await db.query.suppliers.findFirst({
    where: and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, supplierId)),
  });
  return row ? toSupplier(row) : null;
}

export async function createSupplierRecord(
  tenantId: string,
  payload: Omit<SupplierInsert, "tenant_id">,
): Promise<Supplier> {
  const db = getDb();
  const [row] = await db
    .insert(suppliers)
    .values({
      tenantId,
      name: payload.name,
      contactPerson: payload.contact_person,
      phone: payload.phone,
      address: payload.address,
      email: payload.email,
      paymentTermDays: payload.payment_term_days ?? 30,
      outstandingDebt: payload.outstanding_debt ?? 0,
      isActive: payload.is_active ?? true,
    })
    .returning();
  return toSupplier(row);
}

export async function updateSupplierById(
  tenantId: string,
  supplierId: string,
  updates: SupplierUpdate,
): Promise<Supplier | null> {
  const db = getDb();
  const patch: Partial<typeof suppliers.$inferInsert> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.contact_person !== undefined) patch.contactPerson = updates.contact_person;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  if (updates.address !== undefined) patch.address = updates.address;
  if (updates.email !== undefined) patch.email = updates.email;
  if (updates.payment_term_days !== undefined) patch.paymentTermDays = updates.payment_term_days;
  if (updates.outstanding_debt !== undefined) patch.outstandingDebt = updates.outstanding_debt;
  if (updates.is_active !== undefined) patch.isActive = updates.is_active;

  const [row] = await db
    .update(suppliers)
    .set(patch)
    .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, supplierId)))
    .returning();
  return row ? toSupplier(row) : null;
}

async function loadPoItems(tenantId: string, poIds: string[]): Promise<Map<string, PoItem[]>> {
  if (poIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db.query.purchaseOrderItems.findMany({
    where: and(eq(purchaseOrderItems.tenantId, tenantId), inArray(purchaseOrderItems.poId, poIds)),
  });
  const map = new Map<string, PoItem[]>();
  for (const row of rows) {
    const item = toPoItem(row);
    const list = map.get(row.poId) ?? [];
    list.push(item);
    map.set(row.poId, list);
  }
  return map;
}

export async function listPurchaseOrders(
  tenantId: string,
  branchId?: string,
  options?: { status?: PurchaseOrder["status"]; supplierId?: string },
): Promise<(PurchaseOrder & { items: PoItem[]; supplier?: { name: string } })[]> {
  const db = getDb();
  const conditions = [eq(purchaseOrders.tenantId, tenantId)];
  if (branchId) conditions.push(eq(purchaseOrders.branchId, branchId));
  if (options?.status) conditions.push(eq(purchaseOrders.status, options.status));
  if (options?.supplierId) conditions.push(eq(purchaseOrders.supplierId, options.supplierId));

  const rows = await db.query.purchaseOrders.findMany({
    where: and(...conditions),
    orderBy: desc(purchaseOrders.createdAt),
  });

  const poIds = rows.map((r) => r.id);
  const supplierIds = [...new Set(rows.map((r) => r.supplierId))];
  const itemsMap = await loadPoItems(tenantId, poIds);

  const supplierRows = await db.query.suppliers.findMany({
    where: and(eq(suppliers.tenantId, tenantId), inArray(suppliers.id, supplierIds)),
  });
  const supplierNameMap = new Map(supplierRows.map((s) => [s.id, s.name]));

  return rows.map((row) => ({
    ...toPurchaseOrder(row),
    items: itemsMap.get(row.id) ?? [],
    supplier: { name: supplierNameMap.get(row.supplierId) ?? "" },
  }));
}

export async function getPurchaseOrderById(
  tenantId: string,
  poId: string,
): Promise<(PurchaseOrder & { items: PoItem[]; supplier?: Supplier }) | null> {
  const db = getDb();
  const row = await db.query.purchaseOrders.findFirst({
    where: and(eq(purchaseOrders.tenantId, tenantId), eq(purchaseOrders.id, poId)),
  });
  if (!row) return null;

  const itemRows = await db.query.purchaseOrderItems.findMany({
    where: eq(purchaseOrderItems.poId, poId),
  });
  const supplier = await getSupplierById(tenantId, row.supplierId);

  return {
    ...toPurchaseOrder(row),
    items: itemRows.map(toPoItem),
    supplier: supplier ?? undefined,
  };
}

export async function createPurchaseOrderRecord(
  tenantId: string,
  po: Omit<PurchaseOrderInsert, "tenant_id">,
  items: Omit<PoItemInsert, "po_id" | "tenant_id">[],
): Promise<PurchaseOrder> {
  const db = getDb();
  const prefix = po.type === "indent" ? "PO-IND" : "PO";
  const poNumber =
    po.po_number ||
    (await nextDocNumberForTable(
      db,
      purchaseOrders,
      purchaseOrders.tenantId,
      purchaseOrders.poNumber,
      tenantId,
      prefix,
    ));

  return db.transaction(async (tx) => {
    const [poRow] = await tx
      .insert(purchaseOrders)
      .values({
        tenantId,
        branchId: po.branch_id,
        poNumber,
        type: po.type ?? "regular",
        salesOrderId: po.sales_order_id,
        supplierId: po.supplier_id,
        deliveryAddress: po.delivery_address,
        subtotal: po.subtotal,
        grandTotal: po.grand_total,
        status: po.status ?? "draft",
        expectedDate: po.expected_date,
        notes: po.notes,
        createdBy: po.created_by,
      })
      .returning();

    if (items.length > 0) {
      await tx.insert(purchaseOrderItems).values(
        items.map((item) => ({
          poId: poRow.id,
          tenantId,
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          unit: item.unit,
          orderedQty: item.ordered_qty,
          receivedQty: item.received_qty ?? 0,
          purchasePrice: item.purchase_price,
          subtotal: item.subtotal,
        })),
      );
    }

    return toPurchaseOrder(poRow);
  });
}

export async function updatePurchaseOrderStatusById(
  tenantId: string,
  poId: string,
  status: PurchaseOrder["status"],
): Promise<PurchaseOrder | null> {
  const db = getDb();
  const [row] = await db
    .update(purchaseOrders)
    .set({ status })
    .where(and(eq(purchaseOrders.tenantId, tenantId), eq(purchaseOrders.id, poId)))
    .returning();
  return row ? toPurchaseOrder(row) : null;
}

async function recomputePoStatus(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  tenantId: string,
  poId: string,
): Promise<PurchaseOrder["status"]> {
  const items = await tx.query.purchaseOrderItems.findMany({
    where: and(eq(purchaseOrderItems.tenantId, tenantId), eq(purchaseOrderItems.poId, poId)),
  });
  if (items.length === 0) return "received";

  const allReceived = items.every((i) => i.receivedQty >= i.orderedQty);
  const anyReceived = items.some((i) => i.receivedQty > 0);
  if (allReceived) return "received";
  if (anyReceived) return "partial_received";
  return "sent";
}

export async function listGoodsReceipts(
  tenantId: string,
  branchId?: string,
): Promise<
  (GoodsReceipt & {
    items: GrItem[];
    supplier?: { name: string };
    po_number?: string;
    po_type?: PurchaseOrder["type"];
  })[]
> {
  const db = getDb();
  const conditions = [eq(goodsReceipts.tenantId, tenantId)];
  if (branchId) conditions.push(eq(goodsReceipts.branchId, branchId));

  const rows = await db.query.goodsReceipts.findMany({
    where: and(...conditions),
    orderBy: desc(goodsReceipts.receivedAt),
  });

  const grIds = rows.map((r) => r.id);
  const poIds = [...new Set(rows.map((r) => r.purchaseOrderId))];

  const itemRows =
    grIds.length > 0
      ? await db.query.goodsReceiptItems.findMany({
          where: inArray(goodsReceiptItems.grId, grIds),
        })
      : [];

  const poRows =
    poIds.length > 0
      ? await db.query.purchaseOrders.findMany({
          where: inArray(purchaseOrders.id, poIds),
        })
      : [];

  const supplierIds = [...new Set(rows.map((r) => r.supplierId))];
  const supplierRows = await db.query.suppliers.findMany({
    where: inArray(suppliers.id, supplierIds),
  });

  const itemsByGr = new Map<string, GrItem[]>();
  for (const row of itemRows) {
    const list = itemsByGr.get(row.grId) ?? [];
    list.push(toGrItem(row));
    itemsByGr.set(row.grId, list);
  }

  const poMap = new Map(poRows.map((p) => [p.id, p]));
  const supplierMap = new Map(supplierRows.map((s) => [s.id, s.name]));

  return rows.map((row) => {
    const po = poMap.get(row.purchaseOrderId);
    return {
      ...toGoodsReceipt(row),
      items: itemsByGr.get(row.id) ?? [],
      supplier: { name: supplierMap.get(row.supplierId) ?? "" },
      po_number: po?.poNumber,
      po_type: po?.type,
    };
  });
}

export async function createGoodsReceiptRecord(
  tenantId: string,
  gr: Omit<GoodsReceiptInsert, "tenant_id">,
  items: Omit<GrItemInsert, "gr_id" | "tenant_id">[],
  userId: string,
): Promise<GoodsReceipt> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const grNumber =
      gr.gr_number ||
      (await nextDocNumberForTable(
        tx as unknown as ReturnType<typeof getDb>,
        goodsReceipts,
        goodsReceipts.tenantId,
        goodsReceipts.grNumber,
        tenantId,
        "GR",
      ));

    const [grRow] = await tx
      .insert(goodsReceipts)
      .values({
        tenantId,
        branchId: gr.branch_id,
        grNumber,
        purchaseOrderId: gr.purchase_order_id,
        supplierId: gr.supplier_id,
        receivedBy: userId,
        receivedAt: gr.received_at ? new Date(gr.received_at) : new Date(),
        notes: gr.notes,
      })
      .returning();

    if (items.length > 0) {
      await tx.insert(goodsReceiptItems).values(
        items.map((item) => ({
          grId: grRow.id,
          tenantId,
          productId: item.product_id,
          productName: item.product_name,
          orderedQty: item.ordered_qty,
          receivedQty: item.received_qty,
          unit: item.unit,
        })),
      );
    }

    const po = await tx.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.tenantId, tenantId),
        eq(purchaseOrders.id, gr.purchase_order_id),
      ),
    });
    if (!po) throw new Error("PO tidak ditemukan");

    for (const item of items) {
      if (!item.product_id || item.received_qty <= 0) continue;

      const bp = await tx.query.branchProducts.findFirst({
        where: and(
          eq(branchProducts.tenantId, tenantId),
          eq(branchProducts.branchId, gr.branch_id),
          eq(branchProducts.productId, item.product_id),
        ),
      });
      if (!bp) continue;

      const currentQty = bp.stock;
      const newQty = currentQty + item.received_qty;

      await tx
        .update(branchProducts)
        .set({ stock: newQty })
        .where(eq(branchProducts.id, bp.id));

      await tx.insert(stockMovements).values({
        tenantId,
        branchId: gr.branch_id,
        productId: item.product_id,
        type: "in",
        stockSource: "verified",
        qty: item.received_qty,
        qtyBefore: currentQty,
        qtyAfter: newQty,
        reference: grRow.grNumber,
        notes: "Penerimaan barang dari PO",
        userId,
      });

      const poItem = await tx.query.purchaseOrderItems.findFirst({
        where: and(
          eq(purchaseOrderItems.poId, gr.purchase_order_id),
          eq(purchaseOrderItems.productId, item.product_id),
        ),
      });
      if (poItem) {
        await tx
          .update(purchaseOrderItems)
          .set({ receivedQty: poItem.receivedQty + item.received_qty })
          .where(eq(purchaseOrderItems.id, poItem.id));
      }
    }

    const newStatus = await recomputePoStatus(tx, tenantId, gr.purchase_order_id);
    await tx
      .update(purchaseOrders)
      .set({ status: newStatus })
      .where(eq(purchaseOrders.id, gr.purchase_order_id));

    return toGoodsReceipt(grRow);
  });
}

export async function updatePurchaseOrderById(
  tenantId: string,
  poId: string,
  updates: PurchaseOrderUpdate,
): Promise<PurchaseOrder | null> {
  const db = getDb();
  const patch: Partial<typeof purchaseOrders.$inferInsert> = {};
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.expected_date !== undefined) patch.expectedDate = updates.expected_date;
  if (updates.delivery_address !== undefined) patch.deliveryAddress = updates.delivery_address;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.subtotal !== undefined) patch.subtotal = updates.subtotal;
  if (updates.grand_total !== undefined) patch.grandTotal = updates.grand_total;

  const [row] = await db
    .update(purchaseOrders)
    .set(patch)
    .where(and(eq(purchaseOrders.tenantId, tenantId), eq(purchaseOrders.id, poId)))
    .returning();
  return row ? toPurchaseOrder(row) : null;
}

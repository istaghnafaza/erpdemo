// =============================================================================
// Purchasing service — suppliers, PO, GRN (Phase 5)
// =============================================================================

import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { suppliersKey } from "@/server/cache/keys";
import { invalidateBranchProducts, invalidateSuppliers } from "@/server/cache/invalidate";
import { CACHE_TTL, getCached } from "@/server/cache/redis";
import {
  toGoodsReceipt,
  toGrItem,
  toPoItem,
  toPurchaseOrder,
  toSupplier,
  stockStr,
  num,
} from "@/server/db/mappers";
import {
  accountsPayable,
  branchProducts,
  cashAccounts,
  goodsReceiptItems,
  goodsReceipts,
  products,
  purchaseOrderItems,
  purchaseOrders,
  productSuppliers,
  salesOrderItems,
  soFulfillments,
  stockMovements,
  suppliers,
} from "@/server/db/schema";
import { nextDocNumberForTable } from "@/server/services/doc-numbers";
import { ensureProductSuppliersTable } from "@/server/db/ensure-product-suppliers";
import { ensurePoStatusAwaitingSupplier } from "@/server/db/ensure-po-status-enum";
import { ensureStockOwnershipSchema } from "@/server/db/ensure-stock-ownership-schema";
import { insertCashTransactionInTx } from "@/server/services/finance";
import { PURCHASE_DISCOUNT_CATEGORY } from "@/lib/cashflow-constants";
import { weightedAvgHpp } from "@/lib/po-costing";
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
  SupplierWithProducts,
  ProductSupplier,
} from "@/types/database";

export async function listSuppliers(
  tenantId: string,
  options?: { activeOnly?: boolean; search?: string },
): Promise<Supplier[]> {
  if (options?.search) {
    const db = getDb();
    const conditions = [eq(suppliers.tenantId, tenantId), ilike(suppliers.name, `%${options.search}%`)];
    if (options.activeOnly) conditions.push(eq(suppliers.isActive, true));
    const rows = await db.query.suppliers.findMany({
      where: and(...conditions),
      orderBy: [suppliers.name],
    });
    return rows.map(toSupplier);
  }

  const activeOnly = options?.activeOnly ?? false;
  return getCached(suppliersKey(tenantId, activeOnly), CACHE_TTL.suppliers, async () => {
    const db = getDb();
    const conditions = [eq(suppliers.tenantId, tenantId)];
    if (activeOnly) conditions.push(eq(suppliers.isActive, true));

    const rows = await db.query.suppliers.findMany({
      where: and(...conditions),
      orderBy: [suppliers.name],
    });
    return rows.map(toSupplier);
  });
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
  const supplier = toSupplier(row);
  await invalidateSuppliers(tenantId);
  return supplier;
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
  if (!row) return null;
  await invalidateSuppliers(tenantId);
  return toSupplier(row);
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
  await ensureStockOwnershipSchema();
  if (po.status === "awaiting_supplier") {
    await ensurePoStatusAwaitingSupplier();
  }
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

  const ownershipMode = po.ownership_mode ?? "owned";
  const payTrigger =
    po.pay_trigger ??
    (ownershipMode === "consignment" ? "on_sale" : "on_receipt_credit");

  return db.transaction(async (tx) => {
    const [poRow] = await tx
      .insert(purchaseOrders)
      .values({
        tenantId,
        branchId: po.branch_id,
        poNumber,
        type: po.type ?? "regular",
        ownershipMode,
        payTrigger,
        discountAmount: po.discount_amount ?? 0,
        rebateAfterQty: po.rebate_after_qty ?? null,
        rebatePerUnit: po.rebate_per_unit ?? 0,
        consignmentSoldQty: 0,
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
          sellingPrice: item.selling_price ?? null,
        })),
      );
    }

    return toPurchaseOrder(poRow);
  }).then(async (created) => {
    await invalidateBranchProducts(tenantId, po.branch_id);
    return created;
  });
}

export async function updatePurchaseOrderStatusById(
  tenantId: string,
  poId: string,
  status: PurchaseOrder["status"],
): Promise<PurchaseOrder | null> {
  if (status === "awaiting_supplier") {
    await ensurePoStatusAwaitingSupplier();
  }
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

type PurchasingTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Auto-create hutang supplier dari penerimaan barang (BUG-06). */
async function createPayableFromGrInTx(
  tx: PurchasingTx,
  tenantId: string,
  gr: {
    id: string;
    branchId: string;
    grNumber: string;
    supplierId: string;
    purchaseOrderId: string;
  },
  items: Omit<GrItemInsert, "gr_id" | "tenant_id">[],
  userId: string,
): Promise<void> {
  const po = await tx.query.purchaseOrders.findFirst({
    where: and(eq(purchaseOrders.tenantId, tenantId), eq(purchaseOrders.id, gr.purchaseOrderId)),
  });

  // Konsinyasi (on_sale): tidak buat AP di GR — hutang muncul saat terjual
  if (po?.payTrigger === "on_sale" || po?.ownershipMode === "consignment") {
    return;
  }

  let totalAmount = 0;

  for (const item of items) {
    if (!item.product_id || item.received_qty <= 0) continue;
    const poItem = await tx.query.purchaseOrderItems.findFirst({
      where: and(
        eq(purchaseOrderItems.poId, gr.purchaseOrderId),
        eq(purchaseOrderItems.productId, item.product_id),
      ),
    });
    if (poItem) {
      totalAmount += item.received_qty * poItem.purchasePrice;
    }
  }

  if (totalAmount <= 0) return;

  const discount = Math.max(0, Math.min(po?.discountAmount ?? 0, totalAmount));
  const netAmount = Math.max(0, totalAmount - discount);

  const invoiceNumber = `AP-${gr.grNumber}`;
  const existing = await tx.query.accountsPayable.findFirst({
    where: and(
      eq(accountsPayable.tenantId, tenantId),
      eq(accountsPayable.invoiceNumber, invoiceNumber),
    ),
  });
  if (existing) return;

  const supplier = await tx.query.suppliers.findFirst({
    where: and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, gr.supplierId)),
  });

  const termDays = supplier?.paymentTermDays ?? 30;
  const due = new Date();
  if (po?.payTrigger === "on_receipt_cash") {
    // COD: jatuh tempo hari ini
  } else {
    due.setDate(due.getDate() + termDays);
  }
  const dueDate = due.toISOString().slice(0, 10);
  const isCash = po?.payTrigger === "on_receipt_cash";

  const cashAcc = await tx.query.cashAccounts.findFirst({
    where: and(eq(cashAccounts.tenantId, tenantId), eq(cashAccounts.branchId, gr.branchId)),
  });

  // COD/tunai lunas: kas + catatan di PO saja, jangan masuk daftar hutang supplier
  if (isCash) {
    if (cashAcc && totalAmount > 0) {
      await insertCashTransactionInTx(tx, tenantId, gr.branchId, cashAcc.id, {
        type: "expense",
        amount: totalAmount,
        category: "Pembelian",
        reference: `PO-${gr.grNumber}`,
        description: `COD GR ${gr.grNumber}`,
        user_id: userId,
      });
      if (discount > 0) {
        await insertCashTransactionInTx(tx, tenantId, gr.branchId, cashAcc.id, {
          type: "income",
          amount: discount,
          category: PURCHASE_DISCOUNT_CATEGORY,
          reference: `PO-${gr.grNumber}`,
          description: `Diskon COD GR ${gr.grNumber}`,
          user_id: userId,
        });
      }
    }
    return;
  }

  await tx.insert(accountsPayable).values({
    tenantId,
    branchId: gr.branchId,
    invoiceNumber,
    supplierId: gr.supplierId,
    supplierName: supplier?.name ?? "Supplier",
    purchaseOrderId: gr.purchaseOrderId,
    totalAmount: netAmount,
    paidAmount: 0,
    dueDate,
    status: "unpaid",
  });

  if (netAmount > 0 && supplier) {
    await tx
      .update(suppliers)
      .set({ outstandingDebt: (supplier.outstandingDebt ?? 0) + netAmount })
      .where(eq(suppliers.id, supplier.id));
  }
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
  await ensureStockOwnershipSchema();
  await ensureProductSuppliersTable();
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
    if (po.status === "awaiting_supplier") {
      throw new Error("PO menunggu konfirmasi supplier — belum bisa diterima");
    }
    if (po.status !== "sent" && po.status !== "partial_received") {
      throw new Error("PO belum siap untuk penerimaan barang");
    }

    const isIndentPo = po.type === "indent";

    const indentFulfillments = isIndentPo
      ? await tx.query.soFulfillments.findMany({
          where: and(
            eq(soFulfillments.tenantId, tenantId),
            eq(soFulfillments.purchaseOrderId, gr.purchase_order_id),
            eq(soFulfillments.source, "indent"),
          ),
        })
      : [];

    for (const item of items) {
      if (!item.product_id || item.received_qty <= 0) continue;

      if (!isIndentPo) {
        const bp = await tx.query.branchProducts.findFirst({
          where: and(
            eq(branchProducts.tenantId, tenantId),
            eq(branchProducts.branchId, gr.branch_id),
            eq(branchProducts.productId, item.product_id),
          ),
        });
        if (!bp) continue;

        const currentQty = num(bp.stock);
        const newQty = currentQty + item.received_qty;
        const isConsignment = po.ownershipMode === "consignment";

        await tx
          .update(branchProducts)
          .set({
            stock: stockStr(newQty),
            stockOwnership: isConsignment ? "consignment" : "owned",
            consignmentSupplierId: isConsignment ? po.supplierId : null,
            // Penerimaan PO = stok baru dari supplier → verified qty dari dokumen
            stockStatus: "verified",
          })
          .where(eq(branchProducts.id, bp.id));

        await tx.insert(stockMovements).values({
          tenantId,
          branchId: gr.branch_id,
          productId: item.product_id,
          type: "in",
          stockSource: "verified",
          qty: stockStr(item.received_qty),
          qtyBefore: stockStr(currentQty),
          qtyAfter: stockStr(newQty),
          reference: grRow.grNumber,
          notes: isConsignment
            ? "Penerimaan konsinyasi (milik sales)"
            : "Penerimaan barang dari PO",
          userId,
        });

        const poItemForCost = await tx.query.purchaseOrderItems.findFirst({
          where: and(
            eq(purchaseOrderItems.poId, gr.purchase_order_id),
            eq(purchaseOrderItems.productId, item.product_id),
          ),
        });
        const unitCost = poItemForCost?.purchasePrice ?? 0;
        if (unitCost > 0) {
          await tx
            .insert(productSuppliers)
            .values({
              tenantId,
              productId: item.product_id,
              supplierId: po.supplierId,
              isPreferred: false,
              lastPurchasePrice: unitCost,
            })
            .onConflictDoUpdate({
              target: [
                productSuppliers.tenantId,
                productSuppliers.productId,
                productSuppliers.supplierId,
              ],
              set: { lastPurchasePrice: unitCost },
            });

          // Milik toko: HPP = rata-rata tertimbang stok lama + terima baru (laba POS sinkron).
          if (!isConsignment) {
            const product = await tx.query.products.findFirst({
              where: and(eq(products.tenantId, tenantId), eq(products.id, item.product_id)),
            });
            const oldHpp = product?.purchasePrice ?? unitCost;
            const avgHpp = weightedAvgHpp(currentQty, oldHpp, item.received_qty, unitCost);
            await tx
              .update(products)
              .set({ purchasePrice: avgHpp, updatedAt: new Date() })
              .where(and(eq(products.tenantId, tenantId), eq(products.id, item.product_id)));
          }
        }
      } else {
        for (const f of indentFulfillments) {
          const soItem = await tx.query.salesOrderItems.findFirst({
            where: eq(salesOrderItems.id, f.soItemId),
          });
          if (soItem?.productId === item.product_id && f.status !== "delivered") {
            await tx
              .update(soFulfillments)
              .set({ status: "delivered", createdAt: new Date() })
              .where(eq(soFulfillments.id, f.id));
          }
        }
      }

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

    await createPayableFromGrInTx(tx, tenantId, grRow, items, userId);

    await invalidateBranchProducts(tenantId, gr.branch_id);
    await invalidateSuppliers(tenantId);

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

function toProductSupplier(row: typeof productSuppliers.$inferSelect): ProductSupplier {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    product_id: row.productId,
    supplier_id: row.supplierId,
    is_preferred: row.isPreferred,
  };
}

export async function listProductSupplierLinks(tenantId: string): Promise<ProductSupplier[]> {
  await ensureProductSuppliersTable();
  const db = getDb();
  const rows = await db.query.productSuppliers.findMany({
    where: eq(productSuppliers.tenantId, tenantId),
  });
  return rows.map(toProductSupplier);
}

export async function getProductIdsForSupplier(
  tenantId: string,
  supplierId: string,
): Promise<string[]> {
  await ensureProductSuppliersTable();
  const db = getDb();
  const rows = await db.query.productSuppliers.findMany({
    where: and(
      eq(productSuppliers.tenantId, tenantId),
      eq(productSuppliers.supplierId, supplierId),
    ),
  });
  return rows.map((r) => r.productId);
}

export async function listSuppliersWithProducts(tenantId: string): Promise<SupplierWithProducts[]> {
  const all = await listSuppliers(tenantId);
  const links = await listProductSupplierLinks(tenantId);
  const bySupplier = new Map<string, string[]>();
  for (const link of links) {
    const list = bySupplier.get(link.supplier_id) ?? [];
    list.push(link.product_id);
    bySupplier.set(link.supplier_id, list);
  }
  return all.map((s) => ({ ...s, product_ids: bySupplier.get(s.id) ?? [] }));
}

export async function getSuppliersForProduct(
  tenantId: string,
  productId: string,
  options?: { activeOnly?: boolean },
): Promise<Supplier[]> {
  await ensureProductSuppliersTable();
  const db = getDb();
  const links = await db.query.productSuppliers.findMany({
    where: and(
      eq(productSuppliers.tenantId, tenantId),
      eq(productSuppliers.productId, productId),
    ),
  });

  if (links.length === 0) {
    return listSuppliers(tenantId, { activeOnly: options?.activeOnly ?? true });
  }

  const supplierIds = links.map((l) => l.supplierId);
  const preferredId = links.find((l) => l.isPreferred)?.supplierId ?? supplierIds[0];

  const rows = await db.query.suppliers.findMany({
    where: and(eq(suppliers.tenantId, tenantId), inArray(suppliers.id, supplierIds)),
  });

  let mapped = rows.map(toSupplier);
  if (options?.activeOnly ?? true) mapped = mapped.filter((s) => s.is_active);

  mapped.sort((a, b) => {
    if (a.id === preferredId) return -1;
    if (b.id === preferredId) return 1;
    return a.name.localeCompare(b.name, "id");
  });

  return mapped;
}

export async function getPreferredSupplierIdForProduct(
  tenantId: string,
  productId: string,
): Promise<string | null> {
  await ensureProductSuppliersTable();
  const db = getDb();
  const preferred = await db.query.productSuppliers.findFirst({
    where: and(
      eq(productSuppliers.tenantId, tenantId),
      eq(productSuppliers.productId, productId),
      eq(productSuppliers.isPreferred, true),
    ),
  });
  if (preferred) return preferred.supplierId;

  const any = await db.query.productSuppliers.findFirst({
    where: and(
      eq(productSuppliers.tenantId, tenantId),
      eq(productSuppliers.productId, productId),
    ),
  });
  return any?.supplierId ?? null;
}

export async function setSupplierProductLinks(
  tenantId: string,
  supplierId: string,
  productIds: string[],
  preferredProductId?: string | null,
): Promise<void> {
  await ensureProductSuppliersTable();
  const db = getDb();
  const uniqueIds = [...new Set(productIds.filter(Boolean))];

  await db.transaction(async (tx) => {
    await tx
      .delete(productSuppliers)
      .where(
        and(
          eq(productSuppliers.tenantId, tenantId),
          eq(productSuppliers.supplierId, supplierId),
        ),
      );

    if (uniqueIds.length === 0) return;

    await tx.insert(productSuppliers).values(
      uniqueIds.map((productId) => ({
        tenantId,
        productId,
        supplierId,
        isPreferred: preferredProductId
          ? productId === preferredProductId
          : productId === uniqueIds[0],
      })),
    );
  });

  await invalidateSuppliers(tenantId);
}

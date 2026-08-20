// =============================================================================
// Sales returns service — QC, refund tunai/transfer, offset transaksi baru
// =============================================================================

import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { num, stockStr, toSalesItem, toSalesTransaction } from "@/server/db/mappers";
import { ensureReturnsQtySchema } from "@/server/db/ensure-returns-qty-schema";
import { roundQty } from "@/lib/product-sell-units";
import {
  branchProducts,
  branches,
  cashAccounts,
  cashierSessions,
  customers,
  products,
  returnSettings,
  salesItems,
  salesReturnItems,
  salesReturns,
  salesTransactions,
  stockMovements,
} from "@/server/db/schema";
import { insertCashTransactionInTx } from "@/server/services/finance";
import { formatRefundDeadline, isWithinRefundWindow } from "@/lib/return-window";
import type {
  CompleteReturnRefundInput,
  CreateReturnInput,
  QcReturnLineInput,
  SalesReturnRecord,
} from "@/types/sales-returns";
import type { SalesItem } from "@/types/database";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

function mapReturnRow(
  row: typeof salesReturns.$inferSelect,
  items: (typeof salesReturnItems.$inferSelect)[],
): SalesReturnRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    returnNumber: row.returnNumber,
    originalTransactionId: row.originalTransactionId,
    originalTransactionNumber: row.originalTransactionNumber,
    customerId: row.customerId,
    customerName: row.customerName,
    status: row.status,
    settlement: row.settlement,
    isLateReturn: row.isLateReturn,
    refundMethod: row.refundMethod,
    requestedRefundAmount: row.requestedRefundAmount,
    approvedRefundAmount: row.approvedRefundAmount,
    offsetTransactionId: row.offsetTransactionId,
    reasonNotes: row.reasonNotes,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt.toISOString(),
    qcBy: row.qcBy,
    qcAt: row.qcAt?.toISOString() ?? null,
    qcNotes: row.qcNotes,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    items: items.map((it) => ({
      id: it.id,
      returnId: it.returnId,
      originalSalesItemId: it.originalSalesItemId,
      productId: it.productId,
      productName: it.productName,
      sku: it.sku,
      unit: it.unit,
      qtySold: num(it.qtySold),
      qtyRequested: num(it.qtyRequested),
      qtyQcPassed: num(it.qtyQcPassed),
      unitRefundPrice: it.unitRefundPrice,
      refundSubtotal: it.refundSubtotal,
      qcPassed: it.qcPassed,
      qcRejectReason: it.qcRejectReason,
      stockSource: it.stockSource,
      isNonReturnable: it.isNonReturnable,
    })),
  };
}

async function getWindowDays(tenantId: string): Promise<number> {
  const db = getDb();
  const row = await db.query.returnSettings.findFirst({
    where: eq(returnSettings.tenantId, tenantId),
  });
  return row?.refundWindowDays ?? 1;
}

async function nextReturnNumber(
  tx: Tx,
  tenantId: string,
  branchId: string,
): Promise<string> {
  const branch = await tx.query.branches.findFirst({
    where: and(eq(branches.tenantId, tenantId), eq(branches.id, branchId)),
  });
  const code = branch?.code ?? "BR";
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const [result] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(salesReturns)
    .where(
      and(
        eq(salesReturns.tenantId, tenantId),
        eq(salesReturns.branchId, branchId),
        gte(salesReturns.createdAt, dayStart),
        lte(salesReturns.createdAt, dayEnd),
      ),
    );
  const seq = (result?.count ?? 0) + 1;
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `RTN-${code}-${ymd}-${String(seq).padStart(3, "0")}`;
}

async function restoreReturnStockInTx(
  tx: Tx,
  tenantId: string,
  branchId: string,
  productId: string,
  qty: number,
  stockSource: SalesItem["stock_source"],
  reference: string,
  userId: string | null,
): Promise<void> {
  const bp = await tx.query.branchProducts.findFirst({
    where: and(
      eq(branchProducts.tenantId, tenantId),
      eq(branchProducts.branchId, branchId),
      eq(branchProducts.productId, productId),
    ),
  });
  if (!bp) return;

  const isLegacy = stockSource === "legacy";
  const currentQty = num(isLegacy ? bp.legacyStock : bp.stock);
  const addQty = num(qty);
  const newQty = roundQty(currentQty + addQty);

  await tx
    .update(branchProducts)
    .set(isLegacy ? { legacyStock: stockStr(newQty) } : { stock: stockStr(newQty) })
    .where(eq(branchProducts.id, bp.id));

  await tx.insert(stockMovements).values({
    tenantId,
    branchId,
    productId,
    type: isLegacy ? "legacy_in" : "in",
    stockSource,
    qty: stockStr(addQty),
    qtyBefore: stockStr(currentQty),
    qtyAfter: stockStr(newQty),
    reference,
    notes: "Retur penjualan — stok masuk",
    userId,
  });
}

async function resolveCashAccountInTx(
  tx: Tx,
  tenantId: string,
  branchId: string,
  method: "cash" | "transfer",
): Promise<string> {
  const accountType = method === "cash" ? "cash" : "bank";
  const existing = await tx.query.cashAccounts.findFirst({
    where: and(
      eq(cashAccounts.tenantId, tenantId),
      eq(cashAccounts.branchId, branchId),
      eq(cashAccounts.type, accountType),
      eq(cashAccounts.isActive, true),
    ),
  });
  if (existing) return existing.id;
  const [row] = await tx
    .insert(cashAccounts)
    .values({
      tenantId,
      branchId,
      name: accountType === "cash" ? "Kas Toko" : "Rekening Bank",
      type: accountType,
      balance: 0,
      isActive: true,
    })
    .returning();
  return row!.id;
}

const ACTIVE_RETURN_STATUSES = [
  "pending_qc",
  "qc_completed",
  "pending_approval",
  "pending_offset",
] as const;

async function getPendingReturnQtyByItemInTx(
  tx: Tx,
  transactionId: string,
  excludeReturnId?: string,
): Promise<Map<string, number>> {
  const activeReturns = await tx.query.salesReturns.findMany({
    where: and(
      eq(salesReturns.originalTransactionId, transactionId),
      inArray(salesReturns.status, [...ACTIVE_RETURN_STATUSES]),
    ),
  });
  const map = new Map<string, number>();
  for (const ret of activeReturns) {
    if (excludeReturnId && ret.id === excludeReturnId) continue;
    const retItems = await tx.query.salesReturnItems.findMany({
      where: eq(salesReturnItems.returnId, ret.id),
    });
    for (const ri of retItems) {
      map.set(
        ri.originalSalesItemId,
        (map.get(ri.originalSalesItemId) ?? 0) + num(ri.qtyRequested),
      );
    }
  }
  return map;
}

async function syncTransactionReturnStatusInTx(tx: Tx, transactionId: string): Promise<void> {
  const txRow = await tx.query.salesTransactions.findFirst({
    where: eq(salesTransactions.id, transactionId),
  });
  if (!txRow || txRow.status === "voided") return;

  const itemRows = await tx.query.salesItems.findMany({
    where: eq(salesItems.transactionId, transactionId),
  });
  const pendingByItem = await getPendingReturnQtyByItemInTx(tx, transactionId);

  const finalizedStatus = updateOriginalReturnStatus(
    itemRows.map((i) => ({ qty: num(i.qty), qty_returned: num(i.qtyReturned) })),
  );

  const hasPending = pendingByItem.size > 0;
  let returnStatus: "none" | "partial" | "full" = finalizedStatus;
  if (finalizedStatus !== "full" && hasPending) {
    returnStatus = "partial";
  }

  await tx
    .update(salesTransactions)
    .set({
      returnStatus,
      status: returnStatus === "full" ? "returned" : txRow.status,
    })
    .where(eq(salesTransactions.id, transactionId));
}

function updateOriginalReturnStatus(
  items: { qty: number; qty_returned: number }[],
): "none" | "partial" | "full" {
  const allReturned = items.every((i) => i.qty_returned >= i.qty);
  if (allReturned) return "full";
  const anyReturned = items.some((i) => i.qty_returned > 0);
  return anyReturned ? "partial" : "none";
}

export async function getReturnById(
  tenantId: string,
  returnId: string,
): Promise<SalesReturnRecord | null> {
  const db = getDb();
  const row = await db.query.salesReturns.findFirst({
    where: and(eq(salesReturns.tenantId, tenantId), eq(salesReturns.id, returnId)),
  });
  if (!row) return null;
  const itemRows = await db.query.salesReturnItems.findMany({
    where: eq(salesReturnItems.returnId, returnId),
  });
  return mapReturnRow(row, itemRows);
}

export async function listPendingQcReturns(
  tenantId: string,
  branchId: string,
): Promise<SalesReturnRecord[]> {
  const db = getDb();
  const rows = await db.query.salesReturns.findMany({
    where: and(
      eq(salesReturns.tenantId, tenantId),
      eq(salesReturns.branchId, branchId),
      eq(salesReturns.status, "pending_qc"),
    ),
    orderBy: desc(salesReturns.requestedAt),
  });
  const result: SalesReturnRecord[] = [];
  for (const row of rows) {
    const itemRows = await db.query.salesReturnItems.findMany({
      where: eq(salesReturnItems.returnId, row.id),
    });
    result.push(mapReturnRow(row, itemRows));
  }
  return result;
}

export async function listActiveReturns(
  tenantId: string,
  branchId: string,
): Promise<SalesReturnRecord[]> {
  const db = getDb();
  const rows = await db.query.salesReturns.findMany({
    where: and(
      eq(salesReturns.tenantId, tenantId),
      eq(salesReturns.branchId, branchId),
      inArray(salesReturns.status, [
        "pending_qc",
        "qc_completed",
        "pending_approval",
        "pending_offset",
      ]),
    ),
    orderBy: desc(salesReturns.requestedAt),
  });
  const result: SalesReturnRecord[] = [];
  for (const row of rows) {
    const itemRows = await db.query.salesReturnItems.findMany({
      where: eq(salesReturnItems.returnId, row.id),
    });
    result.push(mapReturnRow(row, itemRows));
  }
  return result;
}

export async function listPendingOffsetReturns(
  tenantId: string,
  branchId: string,
): Promise<SalesReturnRecord[]> {
  const db = getDb();
  const rows = await db.query.salesReturns.findMany({
    where: and(
      eq(salesReturns.tenantId, tenantId),
      eq(salesReturns.branchId, branchId),
      eq(salesReturns.status, "pending_offset"),
    ),
    orderBy: desc(salesReturns.requestedAt),
  });
  const result: SalesReturnRecord[] = [];
  for (const row of rows) {
    const itemRows = await db.query.salesReturnItems.findMany({
      where: eq(salesReturnItems.returnId, row.id),
    });
    result.push(mapReturnRow(row, itemRows));
  }
  return result;
}

export async function createReturnRequest(
  tenantId: string,
  branchId: string,
  userId: string,
  input: CreateReturnInput,
): Promise<SalesReturnRecord> {
  await ensureReturnsQtySchema();
  const db = getDb();
  const windowDays = await getWindowDays(tenantId);

  return db.transaction(async (tx) => {
    const txRow = await tx.query.salesTransactions.findFirst({
      where: and(
        eq(salesTransactions.tenantId, tenantId),
        eq(salesTransactions.id, input.originalTransactionId),
      ),
    });
    if (!txRow) throw new Error("Transaksi asal tidak ditemukan");
    if (txRow.status === "voided") throw new Error("Transaksi sudah void");
    if (txRow.branchId !== branchId) throw new Error("Transaksi bukan cabang ini");

    const itemRows = await tx.query.salesItems.findMany({
      where: eq(salesItems.transactionId, input.originalTransactionId),
    });
    const itemMap = new Map(itemRows.map((i) => [i.id, i]));
    const pendingByItem = await getPendingReturnQtyByItemInTx(tx, input.originalTransactionId);

    const isLate = !isWithinRefundWindow(txRow.createdAt, new Date(), windowDays);
    let requestedTotal = 0;
    const pendingItems: Omit<typeof salesReturnItems.$inferInsert, "returnId">[] = [];

    for (const line of input.lines) {
      const orig = itemMap.get(line.salesItemId);
      if (!orig) throw new Error(`Baris transaksi tidak ditemukan: ${line.salesItemId}`);
      if (orig.isSoLine) throw new Error(`Barang SO tidak bisa diretur: ${orig.sku}`);
      const qtySold = num(orig.qty);
      const qtyReturned = num(orig.qtyReturned);
      const pendingQty = num(pendingByItem.get(orig.id) ?? 0);
      const qtyRequested = num(line.qty);
      const available = roundQty(qtySold - qtyReturned - pendingQty);
      if (qtyRequested <= 0 || qtyRequested > available) {
        if (pendingQty > 0 && available <= 0) {
          throw new Error(
            `${orig.sku}: semua qty sudah diajukan retur atau sudah diretur`,
          );
        }
        if (pendingQty > 0) {
          throw new Error(
            `Qty retur tidak valid untuk ${orig.sku} (max ${available}, ${pendingQty} qty menunggu proses retur)`,
          );
        }
        throw new Error(`Qty retur tidak valid untuk ${orig.sku} (max ${available})`);
      }

      if (orig.productId) {
        const prod = await tx.query.products.findFirst({
          where: eq(products.id, orig.productId),
        });
        if (prod && prod.isReturnable === false) {
          const label = prod.returnBlockLabel ? ` (${prod.returnBlockLabel})` : "";
          throw new Error(`Produk tidak bisa diretur: ${orig.productName}${label}`);
        }
      }

      const unitPrice = qtySold > 0 ? Math.round(orig.subtotal / qtySold) : 0;
      const lineTotal = unitPrice * qtyRequested;
      requestedTotal += lineTotal;

      pendingItems.push({
        tenantId,
        originalSalesItemId: orig.id,
        productId: orig.productId,
        productName: orig.productName,
        sku: orig.sku,
        unit: orig.unit,
        qtySold: stockStr(qtySold),
        qtyRequested: stockStr(qtyRequested),
        unitRefundPrice: unitPrice,
        refundSubtotal: 0,
        stockSource: orig.stockSource,
        isNonReturnable: false,
      });
    }

    if (pendingItems.length === 0) throw new Error("Pilih minimal 1 barang retur");

    const returnNumber = await nextReturnNumber(tx, tenantId, branchId);
    const [retRow] = await tx
      .insert(salesReturns)
      .values({
        tenantId,
        branchId,
        returnNumber,
        originalTransactionId: txRow.id,
        originalTransactionNumber: txRow.transactionNumber,
        customerId: txRow.customerId,
        customerName: txRow.customerName,
        status: "pending_qc",
        isLateReturn: isLate,
        requestedRefundAmount: requestedTotal,
        reasonNotes: input.reasonNotes ?? null,
        requestedBy: userId,
      })
      .returning();

    for (const payload of pendingItems) {
      await tx.insert(salesReturnItems).values({ ...payload, returnId: retRow.id });
    }

    const itemRowsOut = await tx.query.salesReturnItems.findMany({
      where: eq(salesReturnItems.returnId, retRow.id),
    });

    await syncTransactionReturnStatusInTx(tx, txRow.id);

    return mapReturnRow(retRow, itemRowsOut);
  });
}

export async function completeReturnQc(
  tenantId: string,
  returnId: string,
  userId: string,
  lines: QcReturnLineInput[],
  qcNotes?: string,
): Promise<SalesReturnRecord> {
  await ensureReturnsQtySchema();
  const db = getDb();

  return db.transaction(async (tx) => {
    const retRow = await tx.query.salesReturns.findFirst({
      where: and(eq(salesReturns.tenantId, tenantId), eq(salesReturns.id, returnId)),
    });
    if (!retRow) throw new Error("Retur tidak ditemukan");
    if (retRow.status !== "pending_qc") throw new Error("Retur tidak dalam status QC");

    const itemRows = await tx.query.salesReturnItems.findMany({
      where: eq(salesReturnItems.returnId, returnId),
    });
    const lineMap = new Map(lines.map((l) => [l.returnItemId, l]));

    let approvedTotal = 0;
    let anyPassed = false;

    for (const item of itemRows) {
      const qc = lineMap.get(item.id);
      if (!qc) throw new Error(`QC belum diisi untuk ${item.sku}`);

      if (qc.passed) {
        anyPassed = true;
        const requested = num(item.qtyRequested);
        const subtotal = item.unitRefundPrice * requested;
        approvedTotal += subtotal;
        await tx
          .update(salesReturnItems)
          .set({
            qcPassed: true,
            qtyQcPassed: stockStr(requested),
            refundSubtotal: subtotal,
            qcRejectReason: null,
          })
          .where(eq(salesReturnItems.id, item.id));
      } else {
        await tx
          .update(salesReturnItems)
          .set({
            qcPassed: false,
            qtyQcPassed: stockStr(0),
            refundSubtotal: 0,
            qcRejectReason: qc.rejectReason ?? "Tidak lolos QC",
          })
          .where(eq(salesReturnItems.id, item.id));
      }
    }

    if (!anyPassed) {
      const [rejected] = await tx
        .update(salesReturns)
        .set({
          status: "rejected",
          approvedRefundAmount: 0,
          qcBy: userId,
          qcAt: new Date(),
          qcNotes: qcNotes ?? null,
        })
        .where(eq(salesReturns.id, returnId))
        .returning();
      const outItems = await tx.query.salesReturnItems.findMany({
        where: eq(salesReturnItems.returnId, returnId),
      });
      await syncTransactionReturnStatusInTx(tx, retRow.originalTransactionId);
      return mapReturnRow(rejected!, outItems);
    }

    const [updated] = await tx
      .update(salesReturns)
      .set({
        status: "qc_completed",
        approvedRefundAmount: approvedTotal,
        qcBy: userId,
        qcAt: new Date(),
        qcNotes: qcNotes ?? null,
      })
      .where(eq(salesReturns.id, returnId))
      .returning();

    const outItems = await tx.query.salesReturnItems.findMany({
      where: eq(salesReturnItems.returnId, returnId),
    });
    return mapReturnRow(updated!, outItems);
  });
}

export async function chooseReturnSettlement(
  tenantId: string,
  returnId: string,
  settlement: "standalone_refund" | "offset_in_new_sale",
  opts?: { requestLateCash?: boolean },
): Promise<SalesReturnRecord> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const retRow = await tx.query.salesReturns.findFirst({
      where: and(eq(salesReturns.tenantId, tenantId), eq(salesReturns.id, returnId)),
    });
    if (!retRow) throw new Error("Retur tidak ditemukan");
    if (retRow.status !== "qc_completed") throw new Error("Retur belum selesai QC");

    if (settlement === "offset_in_new_sale") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const requested = new Date(retRow.requestedAt);
      requested.setHours(0, 0, 0, 0);
      if (requested.getTime() !== today.getTime()) {
        throw new Error("Offset transaksi baru hanya bisa di hari yang sama dengan pengajuan retur");
      }

      const [updated] = await tx
        .update(salesReturns)
        .set({ settlement: "offset_in_new_sale", status: "pending_offset" })
        .where(eq(salesReturns.id, returnId))
        .returning();
      const items = await tx.query.salesReturnItems.findMany({
        where: eq(salesReturnItems.returnId, returnId),
      });
      return mapReturnRow(updated!, items);
    }

    if (retRow.isLateReturn && opts?.requestLateCash) {
      const [updated] = await tx
        .update(salesReturns)
        .set({ settlement: "standalone_refund", status: "pending_approval" })
        .where(eq(salesReturns.id, returnId))
        .returning();
      const items = await tx.query.salesReturnItems.findMany({
        where: eq(salesReturnItems.returnId, returnId),
      });
      return mapReturnRow(updated!, items);
    }

    if (retRow.isLateReturn) {
      throw new Error(
        "Retur lewat batas — pilih potong di transaksi baru atau minta approve manager untuk refund tunai",
      );
    }

    const [updated] = await tx
      .update(salesReturns)
      .set({ settlement: "standalone_refund", status: "qc_completed" })
      .where(eq(salesReturns.id, returnId))
      .returning();
    const items = await tx.query.salesReturnItems.findMany({
      where: eq(salesReturnItems.returnId, returnId),
    });
    return mapReturnRow(updated!, items);
  });
}

export async function approveLateReturnRefund(
  tenantId: string,
  returnId: string,
  approverId: string,
): Promise<SalesReturnRecord> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const retRow = await tx.query.salesReturns.findFirst({
      where: and(eq(salesReturns.tenantId, tenantId), eq(salesReturns.id, returnId)),
    });
    if (!retRow) throw new Error("Retur tidak ditemukan");
    if (retRow.status !== "pending_approval") throw new Error("Retur tidak menunggu approval");

    const [updated] = await tx
      .update(salesReturns)
      .set({
        status: "qc_completed",
        settlement: "standalone_refund",
        approvedBy: approverId,
        approvedAt: new Date(),
      })
      .where(eq(salesReturns.id, returnId))
      .returning();
    const items = await tx.query.salesReturnItems.findMany({
      where: eq(salesReturnItems.returnId, returnId),
    });
    return mapReturnRow(updated!, items);
  });
}

async function finalizeReturnInTx(
  tx: Tx,
  tenantId: string,
  returnId: string,
  userId: string,
  sessionId: string | null,
  refundMethod: "cash" | "transfer" | "credit_adjust",
  offsetTransactionId?: string,
): Promise<SalesReturnRecord> {
  const retRow = await tx.query.salesReturns.findFirst({
    where: and(eq(salesReturns.tenantId, tenantId), eq(salesReturns.id, returnId)),
  });
  if (!retRow) throw new Error("Retur tidak ditemukan");
  if (retRow.status === "completed") {
    const items = await tx.query.salesReturnItems.findMany({
      where: eq(salesReturnItems.returnId, returnId),
    });
    return mapReturnRow(retRow, items);
  }

  const origTx = await tx.query.salesTransactions.findFirst({
    where: eq(salesTransactions.id, retRow.originalTransactionId),
  });
  if (!origTx) throw new Error("Transaksi asal tidak ditemukan");

  const returnItemRows = await tx.query.salesReturnItems.findMany({
    where: eq(salesReturnItems.returnId, returnId),
  });

  const refundAmount = retRow.approvedRefundAmount;
  if (refundAmount <= 0) throw new Error("Nilai retur nol");

  for (const ri of returnItemRows) {
    if (!ri.qcPassed || num(ri.qtyQcPassed) <= 0 || !ri.productId) continue;

    await restoreReturnStockInTx(
      tx,
      tenantId,
      retRow.branchId,
      ri.productId,
      num(ri.qtyQcPassed),
      ri.stockSource,
      retRow.returnNumber,
      userId,
    );

    const origItem = await tx.query.salesItems.findFirst({
      where: eq(salesItems.id, ri.originalSalesItemId),
    });
    if (origItem) {
      await tx
        .update(salesItems)
        .set({ qtyReturned: stockStr(num(origItem.qtyReturned) + num(ri.qtyQcPassed)) })
        .where(eq(salesItems.id, origItem.id));
    }
  }

  const isOffset = Boolean(offsetTransactionId);

  if (!isOffset) {
    if (refundMethod === "credit_adjust" && origTx.customerId) {
      await tx
        .update(customers)
        .set({
          outstandingDebt: sql`GREATEST(0, ${customers.outstandingDebt} - ${refundAmount})`,
        })
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, origTx.customerId)));
    } else if (refundMethod === "cash" || refundMethod === "transfer") {
      const accountId = await resolveCashAccountInTx(
        tx,
        tenantId,
        retRow.branchId,
        refundMethod,
      );
      await insertCashTransactionInTx(tx, tenantId, retRow.branchId, accountId, {
        type: "expense",
        category: "Retur Penjualan",
        amount: refundAmount,
        reference: retRow.returnNumber,
        description: `Refund retur ${retRow.originalTransactionNumber}`,
        user_id: userId,
      });

      if (sessionId && refundMethod === "cash") {
        await tx
          .update(cashierSessions)
          .set({
            totalSales: sql`GREATEST(0, ${cashierSessions.totalSales} - ${refundAmount})`,
            totalCashSales: sql`GREATEST(0, ${cashierSessions.totalCashSales} - ${refundAmount})`,
            expectedCashBalance: sql`GREATEST(0, ${cashierSessions.expectedCashBalance} - ${refundAmount})`,
          })
          .where(eq(cashierSessions.id, sessionId));
      }
    }
  }

  await syncTransactionReturnStatusInTx(tx, origTx.id);

  const [updated] = await tx
    .update(salesReturns)
    .set({
      status: "completed",
      refundMethod: isOffset ? null : refundMethod,
      settlement: isOffset ? "offset_in_new_sale" : retRow.settlement,
      offsetTransactionId: offsetTransactionId ?? retRow.offsetTransactionId,
      completedAt: new Date(),
    })
    .where(eq(salesReturns.id, returnId))
    .returning();

  const { recordAuditEvent } = await import("@/server/services/audit-log");
  await recordAuditEvent({
    tenantId,
    actorId: userId,
    action: "return_sale",
    entityType: "sales_return",
    entityId: returnId,
    metadata: {
      returnNumber: retRow.returnNumber,
      refundAmount,
      refundMethod: isOffset ? "offset" : refundMethod,
      originalTransactionNumber: retRow.originalTransactionNumber,
    },
  });

  const outItems = await tx.query.salesReturnItems.findMany({
    where: eq(salesReturnItems.returnId, returnId),
  });
  return mapReturnRow(updated!, outItems);
}

export async function completeReturnRefund(
  tenantId: string,
  userId: string,
  input: CompleteReturnRefundInput,
): Promise<SalesReturnRecord> {
  await ensureReturnsQtySchema();
  const db = getDb();

  return db.transaction(async (tx) => {
    const retRow = await tx.query.salesReturns.findFirst({
      where: and(eq(salesReturns.tenantId, tenantId), eq(salesReturns.id, input.returnId)),
    });
    if (!retRow) throw new Error("Retur tidak ditemukan");
    if (retRow.settlement !== "standalone_refund") {
      throw new Error("Retur tidak dalam mode refund tunai/transfer");
    }
    if (retRow.status !== "qc_completed") {
      throw new Error("Retur belum siap refund");
    }

    const origTx = await tx.query.salesTransactions.findFirst({
      where: eq(salesTransactions.id, retRow.originalTransactionId),
    });

    let method: "cash" | "transfer" | "credit_adjust" = input.refundMethod;
    if (origTx?.paymentMethod === "credit" && origTx.customerId) {
      method = "credit_adjust";
    }

    return finalizeReturnInTx(tx, tenantId, input.returnId, userId, input.sessionId ?? null, method);
  });
}

export async function finalizeReturnOffsetInTx(
  tx: Tx,
  tenantId: string,
  returnId: string,
  userId: string,
  newTransactionId: string,
  offsetAmount: number,
): Promise<void> {
  const retRow = await tx.query.salesReturns.findFirst({
    where: and(eq(salesReturns.tenantId, tenantId), eq(salesReturns.id, returnId)),
  });
  if (!retRow) throw new Error("Retur offset tidak ditemukan");
  if (retRow.status !== "pending_offset") throw new Error("Retur tidak siap offset");

  await tx
    .update(salesTransactions)
    .set({ linkedReturnId: returnId, returnOffsetAmount: offsetAmount })
    .where(eq(salesTransactions.id, newTransactionId));

  await finalizeReturnInTx(tx, tenantId, returnId, userId, null, "cash", newTransactionId);
}

export async function getTransactionForReturn(
  tenantId: string,
  transactionId: string,
): Promise<{
  transaction: ReturnType<typeof toSalesTransaction>;
  items: (ReturnType<typeof toSalesItem> & { qty_pending_return: number })[];
  withinWindow: boolean;
  deadlineLabel: string;
} | null> {
  const db = getDb();
  const windowDays = await getWindowDays(tenantId);
  const txRow = await db.query.salesTransactions.findFirst({
    where: and(
      eq(salesTransactions.tenantId, tenantId),
      eq(salesTransactions.id, transactionId),
    ),
  });
  if (!txRow) return null;
  const itemRows = await db.query.salesItems.findMany({
    where: eq(salesItems.transactionId, transactionId),
  });

  const activeReturns = await db.query.salesReturns.findMany({
    where: and(
      eq(salesReturns.originalTransactionId, transactionId),
      inArray(salesReturns.status, [...ACTIVE_RETURN_STATUSES]),
    ),
  });
  const pendingByItem = new Map<string, number>();
  for (const ret of activeReturns) {
    const retItems = await db.query.salesReturnItems.findMany({
      where: eq(salesReturnItems.returnId, ret.id),
    });
    for (const ri of retItems) {
      pendingByItem.set(
        ri.originalSalesItemId,
        (pendingByItem.get(ri.originalSalesItemId) ?? 0) + num(ri.qtyRequested),
      );
    }
  }

  return {
    transaction: toSalesTransaction(txRow),
    items: itemRows.map((row) => ({
      ...toSalesItem(row),
      qty_pending_return: pendingByItem.get(row.id) ?? 0,
    })),
    withinWindow: isWithinRefundWindow(txRow.createdAt, new Date(), windowDays),
    deadlineLabel: formatRefundDeadline(txRow.createdAt, windowDays),
  };
}

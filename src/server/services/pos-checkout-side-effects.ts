// =============================================================================
// POS checkout side-effects — cash book, deliveries, sales orders (same DB tx)
// =============================================================================

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { generateDeliveryNumber } from "@/lib/delivery-utils";
import { orderRequiresPhysicalDelivery } from "@/lib/sales-transaction-utils";
import {
  branches,
  cashAccounts,
  deliveries,
  salesOrderItems,
  salesOrders,
} from "@/server/db/schema";
import { insertCashTransactionInTx } from "@/server/services/finance";
import { nextDocNumberForTable } from "@/server/services/doc-numbers";
import type {
  PosCheckoutExtras,
  PosCheckoutSalesOrderExtra,
} from "@/types/pos-checkout-extras";
import type { SalesTransaction } from "@/types/database";

type Tx = Parameters<Parameters<ReturnType<typeof import("@/server/db").getDb>["transaction"]>[0]>[0];

function paymentStatusOf(grandTotal: number, downPayment: number): "unpaid" | "partial" | "paid" {
  if (downPayment <= 0) return "unpaid";
  if (downPayment >= grandTotal) return "paid";
  return "partial";
}

async function resolveOrCreateCashAccountInTx(
  tx: Tx,
  tenantId: string,
  branchId: string,
  accountType: "cash" | "bank",
): Promise<string> {
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

function cashAccountTypeForPayment(
  paymentMethod: SalesTransaction["payment_method"],
): "cash" | "bank" | null {
  if (paymentMethod === "credit") return null;
  if (paymentMethod === "cash") return "cash";
  return "bank";
}

/** Post POS payment to buku kas (BUG-04). */
export async function postPosSaleToCashBookInTx(
  tx: Tx,
  tenantId: string,
  branchId: string,
  sale: Pick<SalesTransaction, "payment_method" | "grand_total" | "amount_paid" | "transaction_number">,
  userId: string | null,
  customerName: string | null,
): Promise<void> {
  let amount = 0;
  let accountType: "cash" | "bank" | null = null;

  if (sale.payment_method === "credit") {
    if (sale.amount_paid <= 0) return;
    amount = sale.amount_paid;
    accountType = "cash";
  } else {
    amount = sale.grand_total;
    accountType = cashAccountTypeForPayment(sale.payment_method);
  }

  if (!accountType || amount <= 0) return;

  const accountId = await resolveOrCreateCashAccountInTx(tx, tenantId, branchId, accountType);
  const description =
    sale.payment_method === "credit"
      ? `DP penjualan kredit ${sale.transaction_number}`
      : customerName
        ? `Penjualan ke ${customerName}`
        : "Penjualan POS";

  await insertCashTransactionInTx(tx, tenantId, branchId, accountId, {
    type: "income",
    category: "Penjualan",
    amount,
    reference: sale.transaction_number,
    description,
    user_id: userId,
  });
}

/** Balikkan pencatatan kas dari penjualan POS saat void. */
export async function reversePosSaleCashBookInTx(
  tx: Tx,
  tenantId: string,
  branchId: string,
  sale: Pick<SalesTransaction, "payment_method" | "grand_total" | "amount_paid" | "transaction_number">,
  userId: string | null,
): Promise<void> {
  let amount = 0;
  let accountType: "cash" | "bank" | null = null;

  if (sale.payment_method === "credit") {
    if (sale.amount_paid <= 0) return;
    amount = sale.amount_paid;
    accountType = "cash";
  } else {
    amount = sale.grand_total;
    accountType = cashAccountTypeForPayment(sale.payment_method);
  }

  if (!accountType || amount <= 0) return;

  const accountId = await resolveOrCreateCashAccountInTx(tx, tenantId, branchId, accountType);
  await insertCashTransactionInTx(tx, tenantId, branchId, accountId, {
    type: "expense",
    category: "Void Penjualan",
    amount,
    reference: sale.transaction_number,
    description: `Void penjualan ${sale.transaction_number}`,
    user_id: userId,
  });
}

async function nextDeliverySequenceInTx(
  tx: Tx,
  tenantId: string,
  branchId: string,
  day: Date,
): Promise<number> {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.tenantId, tenantId),
        eq(deliveries.branchId, branchId),
        gte(deliveries.createdAt, dayStart),
        lte(deliveries.createdAt, dayEnd),
      ),
    );
  return (row?.count ?? 0) + 1;
}

/** Insert delivery row from POS checkout (BUG-02). */
export async function createDeliveryFromPosInTx(
  tx: Tx,
  tenantId: string,
  branchId: string,
  salesTransactionId: string,
  draft: NonNullable<PosCheckoutExtras["delivery"]>,
): Promise<void> {
  if (!orderRequiresPhysicalDelivery(draft.orderFulfillmentType)) return;
  if (!draft.deliveryAddress.trim()) return;

  const branch = await tx.query.branches.findFirst({
    where: and(eq(branches.tenantId, tenantId), eq(branches.id, branchId)),
  });
  if (!branch) return;

  const now = new Date();
  const seq = await nextDeliverySequenceInTx(tx, tenantId, branchId, now);
  const deliveryNumber = generateDeliveryNumber(branch.code, now, seq);

  await tx.insert(deliveries).values({
    tenantId,
    branchId,
    salesTransactionId,
    deliveryNumber,
    customerName: draft.customerName,
    deliveryAddress: draft.deliveryAddress,
    status: "pending",
    grandTotal: draft.grandTotal,
  });
}

/** Insert sales order from POS SO lines (BUG-03). */
export async function createSalesOrderFromPosInTx(
  tx: Tx,
  tenantId: string,
  branchId: string,
  draft: PosCheckoutSalesOrderExtra,
): Promise<void> {
  if (draft.items.length === 0) return;

  const subtotal = draft.items.reduce(
    (s, i) => s + i.qty * i.selling_price - i.discount,
    0,
  );
  const grandTotal = Math.max(0, subtotal - draft.discount_amount);
  const downPayment = Math.min(grandTotal, Math.max(0, draft.down_payment));

  const soNumber = await nextDocNumberForTable(
    tx as Parameters<typeof nextDocNumberForTable>[0],
    salesOrders,
    salesOrders.tenantId,
    salesOrders.soNumber,
    tenantId,
    "SO",
  );

  const [soRow] = await tx
    .insert(salesOrders)
    .values({
      tenantId,
      branchId,
      soNumber,
      customerId: draft.customer_id,
      customerName: draft.customer_name,
      deliveryAddress: draft.delivery_address,
      subtotal,
      discountAmount: draft.discount_amount,
      grandTotal,
      downPayment,
      status: "confirmed",
      paymentStatus: paymentStatusOf(grandTotal, downPayment),
      notes: `Dibuat otomatis dari checkout POS ${draft.pos_transaction_number}`,
      createdBy: draft.created_by,
    })
    .returning();

  await tx.insert(salesOrderItems).values(
    draft.items.map((item) => ({
      soId: soRow.id,
      tenantId,
      productId: item.product_id,
      productName: item.product_name,
      sku: item.sku,
      unit: item.unit,
      qty: item.qty,
      sellingPrice: item.selling_price,
      discount: item.discount,
      subtotal: item.qty * item.selling_price - item.discount,
      deliveredQty: 0,
      status: "pending" as const,
    })),
  );
}

/** Apply all POS checkout side-effects inside the sale transaction. */
export async function applyPosCheckoutSideEffectsInTx(
  tx: Tx,
  tenantId: string,
  branchId: string,
  sale: SalesTransaction,
  extras: PosCheckoutExtras | undefined,
  userId: string | null,
): Promise<void> {
  await postPosSaleToCashBookInTx(
    tx,
    tenantId,
    branchId,
    sale,
    userId,
    sale.customer_name,
  );

  if (extras?.delivery) {
    await createDeliveryFromPosInTx(tx, tenantId, branchId, sale.id, extras.delivery);
  }

  if (extras?.salesOrder) {
    await createSalesOrderFromPosInTx(tx, tenantId, branchId, {
      ...extras.salesOrder,
      pos_transaction_number: sale.transaction_number,
    });
  }
}

// =============================================================================
// Receivables service — AR + payments (Phase 4)
// =============================================================================

import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/server/db";
import { toAccountReceivable, toArPayment } from "@/server/db/mappers";
import { accountsReceivable, arPayments } from "@/server/db/schema";
import { insertCashTransactionInTx, resolveDefaultCashAccountInTx } from "@/server/services/finance";
import { AR_COLLECTION_CATEGORY } from "@/lib/cashflow-constants";
import { ensureCashflowSchema } from "@/server/db/ensure-cashflow-schema";
import type {
  AccountReceivable,
  AccountReceivableInsert,
  ArPayment,
  ArPaymentInsert,
} from "@/types/database";

function deriveArStatus(
  total: number,
  paid: number,
  dueDate: string,
): AccountReceivable["status"] {
  if (paid >= total) return "paid";
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate < today) return paid > 0 ? "partial" : "overdue";
  return paid > 0 ? "partial" : "unpaid";
}

export async function listReceivables(
  tenantId: string,
  branchId?: string,
  options?: {
    status?: AccountReceivable["status"];
    customerId?: string;
    overdueOnly?: boolean;
  },
): Promise<AccountReceivable[]> {
  const db = getDb();
  const conditions = [eq(accountsReceivable.tenantId, tenantId)];
  if (branchId) conditions.push(eq(accountsReceivable.branchId, branchId));
  if (options?.customerId) conditions.push(eq(accountsReceivable.customerId, options.customerId));
  if (options?.overdueOnly) conditions.push(eq(accountsReceivable.status, "overdue"));
  else if (options?.status) conditions.push(eq(accountsReceivable.status, options.status));

  const rows = await db.query.accountsReceivable.findMany({
    where: and(...conditions),
    orderBy: accountsReceivable.dueDate,
  });
  return rows.map(toAccountReceivable);
}

export async function getReceivableById(
  tenantId: string,
  arId: string,
): Promise<(AccountReceivable & { payments: ArPayment[] }) | null> {
  const db = getDb();
  const row = await db.query.accountsReceivable.findFirst({
    where: and(eq(accountsReceivable.tenantId, tenantId), eq(accountsReceivable.id, arId)),
  });
  if (!row) return null;

  const paymentRows = await db.query.arPayments.findMany({
    where: eq(arPayments.arId, arId),
    orderBy: desc(arPayments.paymentDate),
  });

  return {
    ...toAccountReceivable(row),
    payments: paymentRows.map(toArPayment),
  };
}

export async function createReceivable(
  tenantId: string,
  payload: Omit<AccountReceivableInsert, "tenant_id">,
): Promise<AccountReceivable> {
  const db = getDb();
  const [row] = await db
    .insert(accountsReceivable)
    .values({
      tenantId,
      branchId: payload.branch_id,
      invoiceNumber: payload.invoice_number,
      customerId: payload.customer_id,
      customerName: payload.customer_name,
      salesTransactionId: payload.sales_transaction_id,
      salesOrderId: payload.sales_order_id,
      totalAmount: payload.total_amount,
      paidAmount: payload.paid_amount ?? 0,
      dueDate: payload.due_date,
      status: payload.status ?? "unpaid",
    })
    .returning();
  return toAccountReceivable(row);
}

export async function recordArPayment(
  tenantId: string,
  arId: string,
  payment: Omit<ArPaymentInsert, "tenant_id" | "ar_id">,
  options?: { cashAccountId?: string; branchId?: string },
): Promise<ArPayment> {
  await ensureCashflowSchema();
  const db = getDb();

  return db.transaction(async (tx) => {
    const ar = await tx.query.accountsReceivable.findFirst({
      where: and(eq(accountsReceivable.tenantId, tenantId), eq(accountsReceivable.id, arId)),
    });
    if (!ar) throw new Error("Piutang tidak ditemukan");

    const remaining = ar.totalAmount - ar.paidAmount;
    if (payment.amount > remaining) throw new Error("Nominal melebihi sisa tagihan");

    const newPaid = ar.paidAmount + payment.amount;
    const dueStr = String(ar.dueDate).slice(0, 10);
    const newStatus = deriveArStatus(ar.totalAmount, newPaid, dueStr);

    const [paymentRow] = await tx
      .insert(arPayments)
      .values({
        arId,
        tenantId,
        amount: payment.amount,
        paymentDate: payment.payment_date,
        paymentMethod: payment.payment_method,
        notes: payment.notes,
        userId: payment.user_id,
      })
      .returning();

    await tx
      .update(accountsReceivable)
      .set({ paidAmount: newPaid, status: newStatus })
      .where(eq(accountsReceivable.id, arId));

    const branchId = options?.branchId ?? ar.branchId;
    const accountType = payment.payment_method === "transfer" ? "bank" : "cash";
    const cashAccountId =
      options?.cashAccountId ??
      (await resolveDefaultCashAccountInTx(tx, tenantId, branchId, accountType));

    await insertCashTransactionInTx(tx, tenantId, branchId, cashAccountId, {
      type: "income",
      category: AR_COLLECTION_CATEGORY,
      amount: payment.amount,
      reference: `ar:${paymentRow.id}`,
      description: `Pelunasan piutang ${ar.invoiceNumber}`,
      user_id: payment.user_id,
    });

    return toArPayment(paymentRow);
  });
}

export async function listArPayments(tenantId: string, arId: string): Promise<ArPayment[]> {
  const db = getDb();
  const rows = await db.query.arPayments.findMany({
    where: and(eq(arPayments.tenantId, tenantId), eq(arPayments.arId, arId)),
    orderBy: desc(arPayments.paymentDate),
  });
  return rows.map(toArPayment);
}

export async function refreshOverdueReceivables(tenantId: string): Promise<void> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  await db
    .update(accountsReceivable)
    .set({ status: "overdue" })
    .where(
      and(
        eq(accountsReceivable.tenantId, tenantId),
        inArray(accountsReceivable.status, ["unpaid", "partial"]),
        lt(accountsReceivable.dueDate, today),
      ),
    );
}

export async function getArSummary(
  tenantId: string,
  branchId?: string,
): Promise<{ total: number; overdue: number; unpaid: number; partial: number }> {
  const rows = await listReceivables(tenantId, branchId);
  const open = rows.filter((r) => r.status !== "paid");
  const sum = (status: AccountReceivable["status"]) =>
    open.filter((r) => r.status === status).reduce((acc, r) => acc + r.remaining_amount, 0);

  return {
    total: open.reduce((acc, r) => acc + r.remaining_amount, 0),
    overdue: sum("overdue"),
    unpaid: sum("unpaid"),
    partial: sum("partial"),
  };
}

/** Auto-create AR from credit POS sale */
export async function createReceivableFromCreditSale(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  tenantId: string,
  input: {
    branchId: string;
    customerId: string;
    customerName: string;
    salesTransactionId: string;
    invoiceNumber: string;
    amount: number;
    dueDays?: number;
  },
): Promise<void> {
  if (input.amount <= 0) return;

  const due = new Date();
  due.setDate(due.getDate() + (input.dueDays ?? 30));
  const dueDate = due.toISOString().slice(0, 10);

  await tx.insert(accountsReceivable).values({
    tenantId,
    branchId: input.branchId,
    invoiceNumber: input.invoiceNumber,
    customerId: input.customerId,
    customerName: input.customerName,
    salesTransactionId: input.salesTransactionId,
    totalAmount: input.amount,
    paidAmount: 0,
    dueDate,
    status: "unpaid",
  });
}

type ReceivableTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Tutup piutang terkait penjualan saat void (BUG-01). */
export async function voidReceivableForSaleInTx(
  tx: ReceivableTx,
  tenantId: string,
  salesTransactionId: string,
): Promise<void> {
  const ar = await tx.query.accountsReceivable.findFirst({
    where: and(
      eq(accountsReceivable.tenantId, tenantId),
      eq(accountsReceivable.salesTransactionId, salesTransactionId),
    ),
  });
  if (!ar) return;

  if (ar.paidAmount > 0) {
    throw new Error("VOID_BLOCKED: piutang sudah ada pembayaran — batalkan manual di modul Piutang");
  }

  await tx
    .update(accountsReceivable)
    .set({ paidAmount: ar.totalAmount, status: "paid" })
    .where(eq(accountsReceivable.id, ar.id));
}

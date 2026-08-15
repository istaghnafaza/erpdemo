// =============================================================================
// Payables service — AP + payments (Phase 4)
// =============================================================================

import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/server/db";
import { toAccountPayable, toApPayment } from "@/server/db/mappers";
import { accountsPayable, apPayments } from "@/server/db/schema";
import { insertCashTransactionInTx, resolveDefaultCashAccountInTx } from "@/server/services/finance";
import { AP_PAYMENT_CATEGORY } from "@/lib/cashflow-constants";
import { ensureCashflowSchema } from "@/server/db/ensure-cashflow-schema";
import type {
  AccountPayable,
  AccountPayableInsert,
  ApPayment,
  ApPaymentInsert,
} from "@/types/database";

function deriveApStatus(total: number, paid: number): AccountPayable["status"] {
  if (paid >= total) return "paid";
  return paid > 0 ? "partial" : "unpaid";
}

export async function listPayables(
  tenantId: string,
  branchId?: string,
  options?: { status?: AccountPayable["status"]; supplierId?: string },
): Promise<AccountPayable[]> {
  const db = getDb();
  const conditions = [eq(accountsPayable.tenantId, tenantId)];
  if (branchId) conditions.push(eq(accountsPayable.branchId, branchId));
  if (options?.status) conditions.push(eq(accountsPayable.status, options.status));
  if (options?.supplierId) conditions.push(eq(accountsPayable.supplierId, options.supplierId));

  const rows = await db.query.accountsPayable.findMany({
    where: and(...conditions),
    orderBy: accountsPayable.dueDate,
  });
  return rows.map(toAccountPayable);
}

export async function getPayableById(
  tenantId: string,
  apId: string,
): Promise<(AccountPayable & { payments: ApPayment[] }) | null> {
  const db = getDb();
  const row = await db.query.accountsPayable.findFirst({
    where: and(eq(accountsPayable.tenantId, tenantId), eq(accountsPayable.id, apId)),
  });
  if (!row) return null;

  const paymentRows = await db.query.apPayments.findMany({
    where: eq(apPayments.apId, apId),
    orderBy: desc(apPayments.paymentDate),
  });

  return {
    ...toAccountPayable(row),
    payments: paymentRows.map(toApPayment),
  };
}

export async function createPayable(
  tenantId: string,
  payload: Omit<AccountPayableInsert, "tenant_id">,
): Promise<AccountPayable> {
  const db = getDb();
  const [row] = await db
    .insert(accountsPayable)
    .values({
      tenantId,
      branchId: payload.branch_id,
      invoiceNumber: payload.invoice_number,
      supplierId: payload.supplier_id,
      supplierName: payload.supplier_name,
      purchaseOrderId: payload.purchase_order_id,
      totalAmount: payload.total_amount,
      paidAmount: payload.paid_amount ?? 0,
      dueDate: payload.due_date,
      status: payload.status ?? "unpaid",
    })
    .returning();
  return toAccountPayable(row);
}

export async function recordApPayment(
  tenantId: string,
  apId: string,
  payment: Omit<ApPaymentInsert, "tenant_id" | "ap_id">,
): Promise<ApPayment> {
  await ensureCashflowSchema();
  const db = getDb();

  return db.transaction(async (tx) => {
    const ap = await tx.query.accountsPayable.findFirst({
      where: and(eq(accountsPayable.tenantId, tenantId), eq(accountsPayable.id, apId)),
    });
    if (!ap) throw new Error("Hutang tidak ditemukan");

    const remaining = ap.totalAmount - ap.paidAmount;
    if (payment.amount > remaining) throw new Error("Nominal melebihi sisa tagihan");

    const newPaid = ap.paidAmount + payment.amount;
    const newStatus = deriveApStatus(ap.totalAmount, newPaid);

    const cashAccountId =
      payment.cash_account_id ||
      (await resolveDefaultCashAccountInTx(tx, tenantId, ap.branchId, "cash"));

    const [paymentRow] = await tx
      .insert(apPayments)
      .values({
        apId,
        tenantId,
        amount: payment.amount,
        cashAccountId,
        paymentDate: payment.payment_date,
        notes: payment.notes,
        userId: payment.user_id,
      })
      .returning();

    await tx
      .update(accountsPayable)
      .set({ paidAmount: newPaid, status: newStatus })
      .where(eq(accountsPayable.id, apId));

    await insertCashTransactionInTx(tx, tenantId, ap.branchId, cashAccountId, {
      type: "expense",
      category: AP_PAYMENT_CATEGORY,
      amount: payment.amount,
      reference: `ap:${paymentRow.id}`,
      description: `Bayar hutang ${ap.invoiceNumber}`,
      user_id: payment.user_id,
    });

    return toApPayment(paymentRow);
  });
}

export async function refreshOverduePayables(tenantId: string): Promise<void> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  await db
    .update(accountsPayable)
    .set({ status: "overdue" })
    .where(
      and(
        eq(accountsPayable.tenantId, tenantId),
        inArray(accountsPayable.status, ["unpaid", "partial"]),
        lt(accountsPayable.dueDate, today),
      ),
    );
}

export async function getApSummary(
  tenantId: string,
  branchId?: string,
): Promise<{ total: number; overdue: number; dueSoon: number }> {
  const rows = await listPayables(tenantId, branchId);
  const open = rows.filter((r) => r.status !== "paid");
  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    total: open.reduce((acc, r) => acc + r.remaining_amount, 0),
    overdue: open
      .filter((r) => r.status === "overdue")
      .reduce((acc, r) => acc + r.remaining_amount, 0),
    dueSoon: open
      .filter((r) => {
        const due = new Date(r.due_date);
        return due >= today && due <= in7Days;
      })
      .reduce((acc, r) => acc + r.remaining_amount, 0),
  };
}

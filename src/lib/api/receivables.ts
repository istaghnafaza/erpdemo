// =============================================================================
// Receivables API — accounts receivable + payments
// =============================================================================

import { db as supabase, ok, fail, queryMany, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import {
  neonCreateReceivable,
  neonGetArPayments,
  neonGetArSummary,
  neonGetReceivable,
  neonGetReceivables,
  neonRecordArPayment,
  neonRefreshOverdueReceivables,
} from "@/lib/api/neon/finance-fns";
import type { ApiResponse } from "@/types/app";
import type {
  AccountReceivable, AccountReceivableInsert, AccountReceivableUpdate,
  ArPayment, ArPaymentInsert,
} from "@/types/database";

export async function getReceivables(
  tenantId: string,
  branchId?: string,
  options?: {
    status?: AccountReceivable["status"];
    customerId?: string;
    overdueOnly?: boolean;
  }
): Promise<ApiResponse<AccountReceivable[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetReceivables({ data: { tenantId, branchId, options } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("accounts_receivable")
      .select("*, customer:customer_id(name, phone), payments:ar_payments(*)")
      .eq("tenant_id", tenantId)
      .order("due_date");

    if (branchId)              q = q.eq("branch_id", branchId);
    if (options?.status)       q = q.eq("status", options.status);
    if (options?.customerId)   q = q.eq("customer_id", options.customerId);
    if (options?.overdueOnly)  q = q.eq("status", "overdue");

    return q;
  });
}

export async function getReceivable(
  tenantId: string,
  arId: string
): Promise<ApiResponse<AccountReceivable & { payments: ArPayment[] }>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetReceivable({ data: { tenantId, arId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Piutang tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("accounts_receivable")
      .select("*, customer:customer_id(*), payments:ar_payments(*)")
      .eq("tenant_id", tenantId)
      .eq("id", arId)
      .single();
    if (error) return fail(error);
    return ok(data as AccountReceivable & { payments: ArPayment[] });
  } catch (err) {
    return fail(err);
  }
}

export async function createReceivable(
  tenantId: string,
  payload: Omit<AccountReceivableInsert, "tenant_id">
): Promise<ApiResponse<AccountReceivable>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreateReceivable({ data: { tenantId, payload } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat piutang");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("accounts_receivable")
      .insert({ ...payload, tenant_id: tenantId })
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function recordArPayment(
  tenantId: string,
  arId: string,
  payment: Omit<ArPaymentInsert, "tenant_id" | "ar_id">,
  options?: { cashAccountId?: string; branchId?: string },
): Promise<ApiResponse<ArPayment>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonRecordArPayment({ data: { tenantId, arId, payment, options } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal mencatat pembayaran piutang");
    return ok(result.data);
  }
  try {
    const { data: ar, error: arError } = await supabase
      .from("accounts_receivable")
      .select("total_amount, paid_amount")
      .eq("tenant_id", tenantId)
      .eq("id", arId)
      .single();

    if (arError) return fail(arError);

    const newPaid = ar.paid_amount + payment.amount;
    const newStatus: AccountReceivable["status"] =
      newPaid >= ar.total_amount ? "paid" : "partial";

    const { data: paymentData, error: paymentError } = await supabase
      .from("ar_payments")
      .insert({ ...payment, tenant_id: tenantId, ar_id: arId })
      .select()
      .single();

    if (paymentError) return fail(paymentError);

    const update: AccountReceivableUpdate = { paid_amount: newPaid, status: newStatus };
    const { error: updateError } = await supabase
      .from("accounts_receivable")
      .update(update)
      .eq("tenant_id", tenantId)
      .eq("id", arId);

    if (updateError) return fail(updateError);

    return ok(paymentData);
  } catch (err) {
    return fail(err);
  }
}

export async function getArPayments(
  tenantId: string,
  arId: string
): Promise<ApiResponse<ArPayment[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetArPayments({ data: { tenantId, arId } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() =>
    supabase
      .from("ar_payments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("ar_id", arId)
      .order("payment_date", { ascending: false })
  );
}

export async function refreshOverdueStatus(
  tenantId: string
): Promise<ApiResponse<null>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonRefreshOverdueReceivables({ data: { tenantId } }),
    );
    if (result.error) return fail(result.error);
    return ok(null);
  }
  try {
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("accounts_receivable")
      .update({ status: "overdue" })
      .eq("tenant_id", tenantId)
      .in("status", ["unpaid", "partial"])
      .lt("due_date", today);

    if (error) return fail(error);
    return ok(null);
  } catch (err) {
    return fail(err);
  }
}

export async function getArSummary(
  tenantId: string,
  branchId?: string
): Promise<ApiResponse<{ total: number; overdue: number; unpaid: number; partial: number }>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetArSummary({ data: { tenantId, branchId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal memuat ringkasan piutang");
    return ok(result.data);
  }
  try {
    let q = supabase
      .from("accounts_receivable")
      .select("status, remaining_amount")
      .eq("tenant_id", tenantId)
      .neq("status", "paid");

    if (branchId) q = q.eq("branch_id", branchId);

    const { data, error } = await q;
    if (error) return fail(error);

    type ArRow = { status: string; remaining_amount: number };
    const rows = (data ?? []) as ArRow[];
    const sum = (s: string) =>
      rows.filter((r) => r.status === s).reduce((acc, r) => acc + r.remaining_amount, 0);

    return ok({
      total:   rows.reduce((acc, r) => acc + r.remaining_amount, 0),
      overdue: sum("overdue"),
      unpaid:  sum("unpaid"),
      partial: sum("partial"),
    });
  } catch (err) {
    return fail(err);
  }
}

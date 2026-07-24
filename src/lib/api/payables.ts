// =============================================================================
// Payables API — accounts payable + payments
// =============================================================================

import { db as supabase, ok, fail, queryMany, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import {
  neonCreatePayable,
  neonGetApSummary,
  neonGetPayable,
  neonGetPayables,
  neonRecordApPayment,
  neonRefreshOverduePayables,
} from "@/lib/api/neon/finance-fns";
import type { ApiResponse } from "@/types/app";
import type {
  AccountPayable, AccountPayableInsert, AccountPayableUpdate,
  ApPayment, ApPaymentInsert,
} from "@/types/database";

export async function getPayables(
  tenantId: string,
  branchId?: string,
  options?: { status?: AccountPayable["status"]; supplierId?: string }
): Promise<ApiResponse<AccountPayable[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetPayables({ data: { tenantId, branchId, options } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("accounts_payable")
      .select("*, supplier:supplier_id(name, phone), payments:ap_payments(*)")
      .eq("tenant_id", tenantId)
      .order("due_date");

    if (branchId)            q = q.eq("branch_id", branchId);
    if (options?.status)     q = q.eq("status", options.status);
    if (options?.supplierId) q = q.eq("supplier_id", options.supplierId);

    return q;
  });
}

export async function getPayable(
  tenantId: string,
  apId: string
): Promise<ApiResponse<AccountPayable & { payments: ApPayment[] }>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetPayable({ data: { tenantId, apId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Hutang tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("accounts_payable")
      .select("*, supplier:supplier_id(*), payments:ap_payments(*)")
      .eq("tenant_id", tenantId)
      .eq("id", apId)
      .single();
    if (error) return fail(error);
    return ok(data as AccountPayable & { payments: ApPayment[] });
  } catch (err) {
    return fail(err);
  }
}

export async function createPayable(
  tenantId: string,
  payload: Omit<AccountPayableInsert, "tenant_id">
): Promise<ApiResponse<AccountPayable>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreatePayable({ data: { tenantId, payload } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat hutang");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("accounts_payable")
      .insert({ ...payload, tenant_id: tenantId })
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function recordApPayment(
  tenantId: string,
  apId: string,
  payment: Omit<ApPaymentInsert, "tenant_id" | "ap_id">
): Promise<ApiResponse<ApPayment>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonRecordApPayment({ data: { tenantId, apId, payment } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal mencatat pembayaran hutang");
    return ok(result.data);
  }
  try {
    const { data: ap, error: apError } = await supabase
      .from("accounts_payable")
      .select("total_amount, paid_amount")
      .eq("tenant_id", tenantId)
      .eq("id", apId)
      .single();

    if (apError) return fail(apError);

    const newPaid = ap.paid_amount + payment.amount;
    const newStatus: AccountPayable["status"] =
      newPaid >= ap.total_amount ? "paid" : "partial";

    const { data: paymentData, error: paymentError } = await supabase
      .from("ap_payments")
      .insert({ ...payment, tenant_id: tenantId, ap_id: apId })
      .select()
      .single();

    if (paymentError) return fail(paymentError);

    const update: AccountPayableUpdate = { paid_amount: newPaid, status: newStatus };
    const { error: updateError } = await supabase
      .from("accounts_payable")
      .update(update)
      .eq("tenant_id", tenantId)
      .eq("id", apId);

    if (updateError) return fail(updateError);

    return ok(paymentData);
  } catch (err) {
    return fail(err);
  }
}

export async function getApSummary(
  tenantId: string,
  branchId?: string
): Promise<ApiResponse<{ total: number; overdue: number; dueSoon: number }>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetApSummary({ data: { tenantId, branchId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal memuat ringkasan hutang");
    return ok(result.data);
  }
  try {
    let q = supabase
      .from("accounts_payable")
      .select("status, remaining_amount, due_date")
      .eq("tenant_id", tenantId)
      .neq("status", "paid");

    if (branchId) q = q.eq("branch_id", branchId);

    const { data, error } = await q;
    if (error) return fail(error);

    type ApRow = { status: string; remaining_amount: number; due_date: string };
    const today = new Date();
    const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rows = (data ?? []) as ApRow[];

    return ok({
      total:    rows.reduce((acc, r) => acc + r.remaining_amount, 0),
      overdue:  rows.filter((r) => r.status === "overdue").reduce((acc, r) => acc + r.remaining_amount, 0),
      dueSoon:  rows.filter((r) => {
        const due = new Date(r.due_date);
        return due >= today && due <= in7Days;
      }).reduce((acc, r) => acc + r.remaining_amount, 0),
    });
  } catch (err) {
    return fail(err);
  }
}

export async function refreshOverduePayables(
  tenantId: string
): Promise<ApiResponse<null>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonRefreshOverduePayables({ data: { tenantId } }),
    );
    if (result.error) return fail(result.error);
    return ok(null);
  }
  try {
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("accounts_payable")
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

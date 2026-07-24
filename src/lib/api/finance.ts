// =============================================================================
// Finance API — cash accounts & cash transactions
// =============================================================================

import { db as supabase, ok, fail, queryMany, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import {
  neonCreateCashAccount,
  neonGetBranchCashSummary,
  neonGetCashAccount,
  neonGetCashAccounts,
  neonGetCashTransactions,
  neonRecordCashTransaction,
  neonUpdateCashAccount,
} from "@/lib/api/neon/finance-fns";
import type { ApiResponse, DateRangeFilter } from "@/types/app";
import type {
  CashAccount, CashAccountInsert, CashAccountUpdate,
  CashTransaction, CashTransactionInsert,
} from "@/types/database";

export async function getCashAccounts(
  tenantId: string,
  branchId?: string,
  options?: { activeOnly?: boolean; type?: "cash" | "bank" }
): Promise<ApiResponse<CashAccount[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetCashAccounts({ data: { tenantId, branchId, options } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("cash_accounts")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("type")
      .order("name");

    if (branchId)            q = q.eq("branch_id", branchId);
    if (options?.activeOnly) q = q.eq("is_active", true);
    if (options?.type)       q = q.eq("type", options.type);

    return q;
  });
}

export async function getCashAccount(
  tenantId: string,
  accountId: string
): Promise<ApiResponse<CashAccount>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetCashAccount({ data: { tenantId, accountId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Akun kas tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("cash_accounts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", accountId)
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function createCashAccount(
  tenantId: string,
  payload: Omit<CashAccountInsert, "tenant_id">
): Promise<ApiResponse<CashAccount>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreateCashAccount({ data: { tenantId, payload } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat akun kas");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("cash_accounts")
      .insert({ ...payload, tenant_id: tenantId })
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function updateCashAccount(
  tenantId: string,
  accountId: string,
  updates: CashAccountUpdate
): Promise<ApiResponse<CashAccount>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateCashAccount({ data: { tenantId, accountId, updates } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Akun kas tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("cash_accounts")
      .update(updates)
      .eq("tenant_id", tenantId)
      .eq("id", accountId)
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function recordCashTransaction(
  tenantId: string,
  branchId: string,
  accountId: string,
  tx: Omit<CashTransactionInsert, "tenant_id" | "branch_id" | "cash_account_id">
): Promise<ApiResponse<CashTransaction>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonRecordCashTransaction({ data: { tenantId, branchId, accountId, tx } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal mencatat transaksi kas");
    return ok(result.data);
  }
  try {
    const account = await getCashAccount(tenantId, accountId);
    if (account.error) return fail(account.error);

    const delta = tx.type === "expense" ? -tx.amount : tx.amount;
    const newBalance = account.data!.balance + delta;

    await updateCashAccount(tenantId, accountId, { balance: newBalance });

    const { data, error } = await supabase
      .from("cash_transactions")
      .insert({
        ...tx,
        tenant_id: tenantId,
        branch_id: branchId,
        cash_account_id: accountId,
      })
      .select()
      .single();

    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function getCashTransactions(
  tenantId: string,
  branchId: string,
  options?: {
    accountId?: string;
    type?: CashTransaction["type"];
    dateRange?: DateRangeFilter;
    limit?: number;
  }
): Promise<ApiResponse<CashTransaction[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetCashTransactions({ data: { tenantId, branchId, options } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("cash_transactions")
      .select("*, account:cash_account_id(name, type)")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    if (options?.accountId)       q = q.eq("cash_account_id", options.accountId);
    if (options?.type)            q = q.eq("type", options.type);
    if (options?.dateRange?.from) q = q.gte("created_at", options.dateRange.from);
    if (options?.dateRange?.to)   q = q.lte("created_at", options.dateRange.to);
    if (options?.limit)           q = q.limit(options.limit);

    return q;
  });
}

export async function getBranchCashSummary(
  tenantId: string,
  branchId: string
): Promise<ApiResponse<{ totalCash: number; totalBank: number; total: number }>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetBranchCashSummary({ data: { tenantId, branchId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal memuat ringkasan kas");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("cash_accounts")
      .select("type, balance")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("is_active", true);

    if (error) return fail(error);

    type AccRow = { type: string; balance: number };
    const totalCash = ((data ?? []) as AccRow[])
      .filter((a) => a.type === "cash")
      .reduce((sum, a) => sum + a.balance, 0);

    const totalBank = ((data ?? []) as AccRow[])
      .filter((a) => a.type === "bank")
      .reduce((sum, a) => sum + a.balance, 0);

    return ok({ totalCash, totalBank, total: totalCash + totalBank });
  } catch (err) {
    return fail(err);
  }
}

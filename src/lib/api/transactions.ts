// =============================================================================
// Transactions API — POS sessions, carts, sales transactions
// =============================================================================

import { db as supabase, ok, fail, queryMany, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import {
  neonCloseSession,
  neonCreateCart,
  neonCreateTransaction,
  neonGetActiveCarts,
  neonGetHeldCartsInBranch,
  neonGetNextTransactionSequence,
  neonGetOpenSession,
  neonGetSessions,
  neonGetTransaction,
  neonGetTransactionByNumber,
  neonGetTransactions,
  neonOpenSession,
  neonUpdateCart,
  neonVoidTransaction,
} from "@/lib/api/neon/transaction-fns";
import type { ApiResponse, DateRangeFilter } from "@/types/app";
import type { PosCheckoutExtras } from "@/types/pos-checkout-extras";
import type {
  CashierSession,
  CashierSessionInsert,
  PosCart,
  PosCartInsert,
  PosCartUpdate,
  SalesTransaction,
  SalesTransactionInsert,
  SalesItem,
  SalesItemInsert,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Cashier Sessions
// ---------------------------------------------------------------------------

export async function getOpenSession(
  tenantId: string,
  branchId: string,
  cashierId: string,
): Promise<ApiResponse<CashierSession | null>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetOpenSession({ data: { tenantId, branchId, cashierId } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? null);
  }
  try {
    const { data, error } = await supabase
      .from("cashier_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("cashier_id", cashierId)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function getSessions(
  tenantId: string,
  branchId: string,
  dateRange?: DateRangeFilter,
): Promise<ApiResponse<CashierSession[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetSessions({ data: { tenantId, branchId, dateRange } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("cashier_sessions")
      .select("*, cashier:cashier_id(id, name)")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .order("opened_at", { ascending: false });

    if (dateRange) {
      q = q.gte("opened_at", dateRange.from).lte("opened_at", dateRange.to);
    }
    return q;
  });
}

export async function openSession(
  tenantId: string,
  payload: CashierSessionInsert,
): Promise<ApiResponse<CashierSession>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonOpenSession({ data: { tenantId, payload } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuka sesi");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("cashier_sessions")
      .insert({ ...payload, tenant_id: tenantId })
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function closeSession(
  tenantId: string,
  sessionId: string,
  actualCashBalance: number,
  notes?: string,
): Promise<ApiResponse<CashierSession>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCloseSession({
        data: { tenantId, sessionId, actualCashBalance, notes },
      }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Sesi tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("cashier_sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        actual_cash_balance: actualCashBalance,
        notes: notes ?? null,
      })
      .eq("tenant_id", tenantId)
      .eq("id", sessionId)
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// POS Carts
// ---------------------------------------------------------------------------

export async function getActiveCarts(
  tenantId: string,
  sessionId: string,
): Promise<ApiResponse<PosCart[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetActiveCarts({ data: { tenantId, sessionId } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() =>
    supabase
      .from("pos_carts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("session_id", sessionId)
      .in("status", ["active", "hold"])
      .order("cart_number"),
  );
}

export async function createCart(
  tenantId: string,
  payload: Omit<PosCartInsert, "tenant_id">,
): Promise<ApiResponse<PosCart>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreateCart({ data: { tenantId, payload } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat keranjang");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("pos_carts")
      .insert({ ...payload, tenant_id: tenantId })
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function getHeldCartsInBranch(
  tenantId: string,
  branchId: string,
  excludeCashierId: string,
): Promise<ApiResponse<(PosCart & { cashier: { id: string; name: string } | null })[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetHeldCartsInBranch({ data: { tenantId, branchId, excludeCashierId } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() =>
    supabase
      .from("pos_carts")
      .select("*, cashier:cashier_id(id, name)")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("status", "hold")
      .neq("cashier_id", excludeCashierId)
      .order("updated_at", { ascending: false }),
  );
}

export async function updateCart(
  tenantId: string,
  cartId: string,
  updates: PosCartUpdate,
): Promise<ApiResponse<PosCart>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateCart({ data: { tenantId, cartId, updates } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Keranjang tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("pos_carts")
      .update(updates)
      .eq("tenant_id", tenantId)
      .eq("id", cartId)
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Sales Transactions
// ---------------------------------------------------------------------------

export async function getTransactions(
  tenantId: string,
  branchId: string,
  options?: {
    dateRange?: DateRangeFilter;
    sessionId?: string;
    status?: "completed" | "voided" | "returned";
    limit?: number;
  },
): Promise<ApiResponse<SalesTransaction[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetTransactions({ data: { tenantId, branchId, options } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("sales_transactions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    if (options?.dateRange) {
      q = q.gte("created_at", options.dateRange.from).lte("created_at", options.dateRange.to);
    }
    if (options?.sessionId) q = q.eq("session_id", options.sessionId);
    if (options?.status) q = q.eq("status", options.status);
    if (options?.limit) q = q.limit(options.limit);

    return q;
  });
}

export async function getTransaction(
  tenantId: string,
  transactionId: string,
): Promise<ApiResponse<SalesTransaction & { items: SalesItem[] }>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetTransaction({ data: { tenantId, transactionId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Transaksi tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("sales_transactions")
      .select("*, items:sales_items(*)")
      .eq("tenant_id", tenantId)
      .eq("id", transactionId)
      .single();
    if (error) return fail(error);
    return ok(data as SalesTransaction & { items: SalesItem[] });
  } catch (err) {
    return fail(err);
  }
}

export async function getTransactionByNumber(
  tenantId: string,
  txNumber: string,
): Promise<ApiResponse<SalesTransaction>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetTransactionByNumber({ data: { tenantId, txNumber } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Transaksi tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("sales_transactions")
      .select("*, items:sales_items(*)")
      .eq("tenant_id", tenantId)
      .eq("transaction_number", txNumber)
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function createTransaction(
  tenantId: string,
  transaction: Omit<SalesTransactionInsert, "tenant_id">,
  items: Omit<SalesItemInsert, "transaction_id" | "tenant_id">[],
  extras?: PosCheckoutExtras,
): Promise<ApiResponse<SalesTransaction>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreateTransaction({ data: { tenantId, transaction, items, extras } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal menyimpan transaksi");
    return ok(result.data);
  }
  try {
    const { data: tx, error: txError } = await supabase
      .from("sales_transactions")
      .insert({ ...transaction, tenant_id: tenantId })
      .select()
      .single();

    if (txError) return fail(txError);

    const itemsWithId: SalesItemInsert[] = items.map((item) => ({
      ...item,
      transaction_id: tx.id,
      tenant_id: tenantId,
    }));

    const { error: itemsError } = await supabase.from("sales_items").insert(itemsWithId);

    if (itemsError) return fail(itemsError);

    return ok(tx);
  } catch (err) {
    return fail(err);
  }
}

export async function voidTransaction(
  tenantId: string,
  transactionId: string,
  userId: string,
): Promise<ApiResponse<SalesTransaction>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonVoidTransaction({ data: { tenantId, transactionId, userId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Transaksi tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("sales_transactions")
      .update({ status: "voided" })
      .eq("tenant_id", tenantId)
      .eq("id", transactionId)
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export { generateTransactionNumber } from "@/lib/transaction-number";

// ---------------------------------------------------------------------------
// Transaction number generator — YYYY-MM-DD format + sequence
// ---------------------------------------------------------------------------

const localSequenceCounters = new Map<string, number>();

export function getNextLocalTransactionSequence(branchId: string): number {
  const next = (localSequenceCounters.get(branchId) ?? 0) + 1;
  localSequenceCounters.set(branchId, next);
  return next;
}

export async function getNextTransactionSequence(
  tenantId: string,
  branchId: string,
  date: Date,
): Promise<number> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetNextTransactionSequence({
        data: { tenantId, branchId, dateIso: date.toISOString() },
      }),
    );
    if (result.error) throw new Error(result.error);
    return result.data ?? 1;
  }

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const { count } = await supabase
    .from("sales_transactions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .gte("created_at", dayStart.toISOString())
    .lte("created_at", dayEnd.toISOString());

  return (count ?? 0) + 1;
}

/** Neon createTransaction is atomic (stock + session + debt). Supabase path still needs separate adjustStock. */
export function isAtomicPosBackend(): boolean {
  return isNeonBackend();
}

// =============================================================================
// Finance service — cash accounts & transactions (Phase 4)
// =============================================================================

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/server/db";
import { nullIfEmptyUuid } from "@/server/lib/format-db-error";
import { toCashAccount, toCashTransaction } from "@/server/db/mappers";
import { cashAccounts, cashTransactions } from "@/server/db/schema";
import type { DateRangeFilter } from "@/types/app";
import type {
  CashAccount,
  CashAccountInsert,
  CashAccountUpdate,
  CashTransaction,
  CashTransactionInsert,
} from "@/types/database";

export async function listCashAccounts(
  tenantId: string,
  branchId?: string,
  options?: { activeOnly?: boolean; type?: "cash" | "bank" },
): Promise<CashAccount[]> {
  const db = getDb();
  const conditions = [eq(cashAccounts.tenantId, tenantId)];
  if (branchId) conditions.push(eq(cashAccounts.branchId, branchId));
  if (options?.activeOnly) conditions.push(eq(cashAccounts.isActive, true));
  if (options?.type) conditions.push(eq(cashAccounts.type, options.type));

  const rows = await db.query.cashAccounts.findMany({
    where: and(...conditions),
    orderBy: [cashAccounts.type, cashAccounts.name],
  });
  return rows.map(toCashAccount);
}

export async function getCashAccountById(
  tenantId: string,
  accountId: string,
): Promise<CashAccount | null> {
  const db = getDb();
  const row = await db.query.cashAccounts.findFirst({
    where: and(eq(cashAccounts.tenantId, tenantId), eq(cashAccounts.id, accountId)),
  });
  return row ? toCashAccount(row) : null;
}

export async function createCashAccount(
  tenantId: string,
  payload: Omit<CashAccountInsert, "tenant_id">,
): Promise<CashAccount> {
  const db = getDb();
  const [row] = await db
    .insert(cashAccounts)
    .values({
      tenantId,
      branchId: payload.branch_id,
      name: payload.name,
      type: payload.type,
      accountNumber: payload.account_number,
      balance: payload.balance ?? 0,
      isActive: payload.is_active ?? true,
    })
    .returning();
  return toCashAccount(row);
}

export async function updateCashAccountById(
  tenantId: string,
  accountId: string,
  updates: CashAccountUpdate,
): Promise<CashAccount | null> {
  const db = getDb();
  const patch: Partial<typeof cashAccounts.$inferInsert> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.type !== undefined) patch.type = updates.type;
  if (updates.account_number !== undefined) patch.accountNumber = updates.account_number;
  if (updates.balance !== undefined) patch.balance = updates.balance;
  if (updates.is_active !== undefined) patch.isActive = updates.is_active;

  const [row] = await db
    .update(cashAccounts)
    .set(patch)
    .where(and(eq(cashAccounts.tenantId, tenantId), eq(cashAccounts.id, accountId)))
    .returning();
  return row ? toCashAccount(row) : null;
}

export async function listCashTransactions(
  tenantId: string,
  branchId: string,
  options?: {
    accountId?: string;
    type?: CashTransaction["type"];
    dateRange?: DateRangeFilter;
    limit?: number;
  },
): Promise<CashTransaction[]> {
  const db = getDb();
  const conditions = [
    eq(cashTransactions.tenantId, tenantId),
    eq(cashTransactions.branchId, branchId),
  ];
  if (options?.accountId) conditions.push(eq(cashTransactions.cashAccountId, options.accountId));
  if (options?.type) conditions.push(eq(cashTransactions.type, options.type));
  if (options?.dateRange?.from) {
    conditions.push(gte(cashTransactions.createdAt, new Date(options.dateRange.from)));
  }
  if (options?.dateRange?.to) {
    conditions.push(lte(cashTransactions.createdAt, new Date(options.dateRange.to)));
  }

  const rows = await db.query.cashTransactions.findMany({
    where: and(...conditions),
    orderBy: desc(cashTransactions.createdAt),
    limit: options?.limit,
  });
  return rows.map(toCashTransaction);
}

/** Internal — insert cash tx + update balance within existing DB transaction */
export async function insertCashTransactionInTx(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  tenantId: string,
  branchId: string,
  accountId: string,
  payload: Omit<CashTransactionInsert, "tenant_id" | "branch_id" | "cash_account_id">,
): Promise<CashTransaction> {
  const account = await tx.query.cashAccounts.findFirst({
    where: and(eq(cashAccounts.tenantId, tenantId), eq(cashAccounts.id, accountId)),
  });
  if (!account) throw new Error("Akun kas tidak ditemukan");

  const delta = payload.type === "expense" ? -payload.amount : payload.amount;
  const newBalance = account.balance + delta;
  if (newBalance < 0) throw new Error("Saldo kas tidak cukup");

  await tx
    .update(cashAccounts)
    .set({ balance: newBalance })
    .where(eq(cashAccounts.id, accountId));

  const [row] = await tx
    .insert(cashTransactions)
    .values({
      tenantId,
      branchId,
      cashAccountId: accountId,
      type: payload.type,
      category: payload.category,
      amount: payload.amount,
      reference: payload.reference ?? null,
      description: payload.description ?? null,
      userId: nullIfEmptyUuid(payload.user_id),
    })
    .returning();

  return toCashTransaction(row);
}

export async function recordCashTransaction(
  tenantId: string,
  branchId: string,
  accountId: string,
  tx: Omit<CashTransactionInsert, "tenant_id" | "branch_id" | "cash_account_id">,
): Promise<CashTransaction> {
  const db = getDb();
  return db.transaction(async (trx) =>
    insertCashTransactionInTx(trx, tenantId, branchId, accountId, tx),
  );
}

export async function getBranchCashSummary(
  tenantId: string,
  branchId: string,
): Promise<{ totalCash: number; totalBank: number; total: number }> {
  const accounts = await listCashAccounts(tenantId, branchId, { activeOnly: true });
  const totalCash = accounts.filter((a) => a.type === "cash").reduce((s, a) => s + a.balance, 0);
  const totalBank = accounts.filter((a) => a.type === "bank").reduce((s, a) => s + a.balance, 0);
  return { totalCash, totalBank, total: totalCash + totalBank };
}

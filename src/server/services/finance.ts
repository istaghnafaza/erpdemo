// =============================================================================
// Finance service — cash accounts & transactions (Phase 4 + Cashflow Intelligence)
// =============================================================================

import { and, desc, eq, gte, lte, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ensureCashflowSchema } from "@/server/db/ensure-cashflow-schema";
import { nullIfEmptyUuid } from "@/server/lib/format-db-error";
import { toCashAccount, toCashTransaction } from "@/server/db/mappers";
import { cashAccounts, cashTransactions } from "@/server/db/schema";
import {
  cashBalanceDelta,
  TRANSFER_IN_CATEGORY,
  TRANSFER_OUT_CATEGORY,
} from "@/lib/cashflow-constants";
import type { DateRangeFilter } from "@/types/app";
import type {
  CashAccount,
  CashAccountInsert,
  CashAccountUpdate,
  CashTransaction,
  CashTransactionInsert,
} from "@/types/database";

type DbTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function listCashAccounts(
  tenantId: string,
  branchId?: string,
  options?: { activeOnly?: boolean; type?: "cash" | "bank" },
): Promise<CashAccount[]> {
  await ensureCashflowSchema();
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
  await ensureCashflowSchema();
  const db = getDb();
  const row = await db.query.cashAccounts.findFirst({
    where: and(eq(cashAccounts.tenantId, tenantId), eq(cashAccounts.id, accountId)),
  });
  return row ? toCashAccount(row) : null;
}

async function clearDefaultOfTypeInTx(
  tx: DbTx,
  tenantId: string,
  branchId: string,
  type: "cash" | "bank",
  exceptId?: string,
): Promise<void> {
  const conditions = [
    eq(cashAccounts.tenantId, tenantId),
    eq(cashAccounts.branchId, branchId),
    eq(cashAccounts.type, type),
    eq(cashAccounts.isDefault, true),
  ];
  if (exceptId) conditions.push(ne(cashAccounts.id, exceptId));
  await tx.update(cashAccounts).set({ isDefault: false }).where(and(...conditions));
}

export async function createCashAccount(
  tenantId: string,
  payload: Omit<CashAccountInsert, "tenant_id">,
): Promise<CashAccount> {
  await ensureCashflowSchema();
  const db = getDb();
  return db.transaction(async (tx) => {
    const existing = await tx.query.cashAccounts.findMany({
      where: and(
        eq(cashAccounts.tenantId, tenantId),
        eq(cashAccounts.branchId, payload.branch_id),
        eq(cashAccounts.type, payload.type),
        eq(cashAccounts.isActive, true),
      ),
    });
    const makeDefault = payload.is_default === true || existing.length === 0;
    if (makeDefault) {
      await clearDefaultOfTypeInTx(tx, tenantId, payload.branch_id, payload.type);
    }

    const [row] = await tx
      .insert(cashAccounts)
      .values({
        tenantId,
        branchId: payload.branch_id,
        name: payload.name,
        type: payload.type,
        accountNumber: payload.account_number,
        balance: payload.balance ?? 0,
        isActive: payload.is_active ?? true,
        isDefault: makeDefault,
      })
      .returning();
    return toCashAccount(row);
  });
}

export async function updateCashAccountById(
  tenantId: string,
  accountId: string,
  updates: CashAccountUpdate,
): Promise<CashAccount | null> {
  await ensureCashflowSchema();
  const db = getDb();
  return db.transaction(async (tx) => {
    const current = await tx.query.cashAccounts.findFirst({
      where: and(eq(cashAccounts.tenantId, tenantId), eq(cashAccounts.id, accountId)),
    });
    if (!current) return null;

    if (updates.is_default === true) {
      await clearDefaultOfTypeInTx(
        tx,
        tenantId,
        current.branchId,
        updates.type ?? current.type,
        accountId,
      );
    }

    const patch: Partial<typeof cashAccounts.$inferInsert> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.type !== undefined) patch.type = updates.type;
    if (updates.account_number !== undefined) patch.accountNumber = updates.account_number;
    if (updates.balance !== undefined) patch.balance = updates.balance;
    if (updates.is_active !== undefined) patch.isActive = updates.is_active;
    if (updates.is_default !== undefined) patch.isDefault = updates.is_default;

    const [row] = await tx
      .update(cashAccounts)
      .set(patch)
      .where(and(eq(cashAccounts.tenantId, tenantId), eq(cashAccounts.id, accountId)))
      .returning();
    return row ? toCashAccount(row) : null;
  });
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
  await ensureCashflowSchema();
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

/** Resolve default cash/bank account for a branch; create one if missing. */
export async function resolveDefaultCashAccountInTx(
  tx: DbTx,
  tenantId: string,
  branchId: string,
  accountType: "cash" | "bank",
): Promise<string> {
  const preferred = await tx.query.cashAccounts.findFirst({
    where: and(
      eq(cashAccounts.tenantId, tenantId),
      eq(cashAccounts.branchId, branchId),
      eq(cashAccounts.type, accountType),
      eq(cashAccounts.isActive, true),
      eq(cashAccounts.isDefault, true),
    ),
  });
  if (preferred) return preferred.id;

  const existing = await tx.query.cashAccounts.findFirst({
    where: and(
      eq(cashAccounts.tenantId, tenantId),
      eq(cashAccounts.branchId, branchId),
      eq(cashAccounts.type, accountType),
      eq(cashAccounts.isActive, true),
    ),
  });
  if (existing) {
    await clearDefaultOfTypeInTx(tx, tenantId, branchId, accountType);
    await tx.update(cashAccounts).set({ isDefault: true }).where(eq(cashAccounts.id, existing.id));
    return existing.id;
  }

  const [row] = await tx
    .insert(cashAccounts)
    .values({
      tenantId,
      branchId,
      name: accountType === "cash" ? "Kas Toko" : "Rekening Bank",
      type: accountType,
      balance: 0,
      isActive: true,
      isDefault: true,
    })
    .returning();
  return row!.id;
}

/** Internal — insert cash tx + update balance within existing DB transaction */
export async function insertCashTransactionInTx(
  tx: DbTx,
  tenantId: string,
  branchId: string,
  accountId: string,
  payload: Omit<CashTransactionInsert, "tenant_id" | "branch_id" | "cash_account_id">,
): Promise<CashTransaction> {
  const account = await tx.query.cashAccounts.findFirst({
    where: and(eq(cashAccounts.tenantId, tenantId), eq(cashAccounts.id, accountId)),
  });
  if (!account) throw new Error("Akun kas tidak ditemukan");

  const delta = cashBalanceDelta(payload.type, payload.category, payload.amount);
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
      counterpartAccountId: payload.counterpart_account_id ?? null,
      pairId: payload.pair_id ?? null,
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
  await ensureCashflowSchema();
  const db = getDb();
  return db.transaction(async (trx) =>
    insertCashTransactionInTx(trx, tenantId, branchId, accountId, tx),
  );
}

export async function transferBetweenAccounts(
  tenantId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  userId: string | null,
  description?: string | null,
): Promise<{ out: CashTransaction; in: CashTransaction }> {
  await ensureCashflowSchema();
  if (fromAccountId === toAccountId) throw new Error("Akun sumber dan tujuan harus berbeda");
  if (amount <= 0) throw new Error("Nominal transfer harus lebih dari 0");

  const db = getDb();
  return db.transaction(async (trx) => {
    const from = await trx.query.cashAccounts.findFirst({
      where: and(eq(cashAccounts.tenantId, tenantId), eq(cashAccounts.id, fromAccountId)),
    });
    const to = await trx.query.cashAccounts.findFirst({
      where: and(eq(cashAccounts.tenantId, tenantId), eq(cashAccounts.id, toAccountId)),
    });
    if (!from || !to) throw new Error("Akun kas tidak ditemukan");
    if (from.branchId !== to.branchId) {
      throw new Error("Transfer internal hanya dalam cabang yang sama");
    }

    const pairId = crypto.randomUUID();
    const note = description?.trim() || `Pindah ${from.name} → ${to.name}`;

    const out = await insertCashTransactionInTx(trx, tenantId, from.branchId, fromAccountId, {
      type: "transfer",
      category: TRANSFER_OUT_CATEGORY,
      amount,
      reference: `xfer:${pairId}`,
      description: note,
      user_id: userId,
      counterpart_account_id: toAccountId,
      pair_id: pairId,
    });

    const incoming = await insertCashTransactionInTx(trx, tenantId, to.branchId, toAccountId, {
      type: "transfer",
      category: TRANSFER_IN_CATEGORY,
      amount,
      reference: `xfer:${pairId}`,
      description: note,
      user_id: userId,
      counterpart_account_id: fromAccountId,
      pair_id: pairId,
    });

    return { out, in: incoming };
  });
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

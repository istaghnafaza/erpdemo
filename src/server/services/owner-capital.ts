// =============================================================================
// Owner capital — prive keluar / setoran owner (bukan laba, mengubah kas)
// =============================================================================

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ensureCashflowSchema } from "@/server/db/ensure-cashflow-schema";
import { toOwnerCapitalTransaction } from "@/server/db/mappers";
import { ownerCapitalTransactions } from "@/server/db/schema";
import { insertCashTransactionInTx } from "@/server/services/finance";
import { PRIVE_CATEGORY, SETORAN_OWNER_CATEGORY } from "@/lib/cashflow-constants";
import type { OwnerCapitalTransaction, OwnerCapitalTransactionInsert } from "@/types/database";

export async function listOwnerCapitalTransactions(
  tenantId: string,
  branchIds: string[],
): Promise<OwnerCapitalTransaction[]> {
  await ensureCashflowSchema();
  if (branchIds.length === 0) return [];
  const db = getDb();
  const rows = await db.query.ownerCapitalTransactions.findMany({
    where: and(
      eq(ownerCapitalTransactions.tenantId, tenantId),
      inArray(ownerCapitalTransactions.branchId, branchIds),
    ),
    orderBy: desc(ownerCapitalTransactions.occurredAt),
    limit: 200,
  });
  return rows.map(toOwnerCapitalTransaction);
}

export async function recordOwnerCapital(
  tenantId: string,
  payload: Omit<OwnerCapitalTransactionInsert, "tenant_id">,
): Promise<OwnerCapitalTransaction> {
  await ensureCashflowSchema();
  if (payload.amount <= 0) throw new Error("Nominal harus lebih dari 0");

  const db = getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(ownerCapitalTransactions)
      .values({
        tenantId,
        branchId: payload.branch_id,
        cashAccountId: payload.cash_account_id,
        kind: payload.kind,
        amount: payload.amount,
        occurredAt: payload.occurred_at,
        notes: payload.notes ?? null,
        createdBy: payload.created_by,
      })
      .returning();

    const isPrive = payload.kind === "prive_keluar";
    await insertCashTransactionInTx(tx, tenantId, payload.branch_id, payload.cash_account_id, {
      type: isPrive ? "expense" : "income",
      category: isPrive ? PRIVE_CATEGORY : SETORAN_OWNER_CATEGORY,
      amount: payload.amount,
      reference: `oc:${row.id}`,
      description:
        payload.notes?.trim() ||
        (isPrive ? "Prive owner" : "Setoran modal owner"),
      user_id: payload.created_by,
    });

    return toOwnerCapitalTransaction(row);
  });
}

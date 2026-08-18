// =============================================================================
// Transactions service — Neon/Drizzle (Phase 3)
// =============================================================================

import { and, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ensurePosSchema } from "@/server/db/ensure-pos-schema";
import { ensureSellUnitsSchema } from "@/server/db/ensure-sell-units-schema";
import { formatDbError, nullIfEmptyUuid } from "@/server/lib/format-db-error";
import {
  invalidateBranchProducts,
  invalidateCustomers,
} from "@/server/cache/invalidate";
import {
  toCashierSession,
  toPosCart,
  toSalesItem,
  toSalesTransaction,
  num,
  stockStr,
} from "@/server/db/mappers";
import { toBaseQty, roundQty } from "@/lib/product-sell-units";
import {
  branchProducts,
  branches,
  cashAccounts,
  cashierSessions,
  customers,
  posCarts,
  profiles,
  salesItems,
  salesReturns,
  salesTransactions,
  stockMovements,
} from "@/server/db/schema";
import type { DateRangeFilter } from "@/types/app";
import type { PosCheckoutExtras } from "@/types/pos-checkout-extras";
import { reversePosSaleCashBookInTx } from "@/server/services/pos-checkout-side-effects";
import { insertCashTransactionInTx } from "@/server/services/finance";
import { generateTransactionNumber } from "@/lib/transaction-number";
import type {
  CashierSession,
  CashierSessionInsert,
  PosCart,
  PosCartInsert,
  PosCartUpdate,
  SalesItem,
  SalesItemInsert,
  SalesTransaction,
  SalesTransactionInsert,
} from "@/types/database";

type PaymentMethod = SalesTransaction["payment_method"];

function sessionBucketField(
  pm: PaymentMethod,
): "totalCashSales" | "totalCardSales" | "totalTransferSales" | "totalCreditSales" {
  if (pm === "cash") return "totalCashSales";
  if (pm === "card") return "totalCardSales";
  if (pm === "transfer") return "totalTransferSales";
  if (pm === "credit") return "totalCreditSales";
  return "totalCardSales";
}

function computeSessionDeltas(
  paymentMethod: PaymentMethod,
  grandTotal: number,
  amountPaid: number,
): {
  totalSales: number;
  totalTransactions: number;
  totalCashSales: number;
  totalCardSales: number;
  totalTransferSales: number;
  totalCreditSales: number;
  expectedCashDelta: number;
} {
  const base = {
    totalSales: grandTotal,
    totalTransactions: 1,
    totalCashSales: 0,
    totalCardSales: 0,
    totalTransferSales: 0,
    totalCreditSales: 0,
    expectedCashDelta: 0,
  };

  if (paymentMethod === "credit") {
    const creditDebt = grandTotal - amountPaid;
    base.totalCreditSales = creditDebt;
    if (amountPaid > 0) {
      base.totalCashSales = amountPaid;
      base.expectedCashDelta = amountPaid;
    }
    return base;
  }

  const bucket = sessionBucketField(paymentMethod);
  base[bucket] = grandTotal;
  if (paymentMethod === "cash") {
    base.expectedCashDelta = grandTotal;
  }
  return base;
}

function isSoLineItem(item: Pick<SalesItemInsert, "is_so_line">): boolean {
  return item.is_so_line === true;
}

async function deductStockInTx(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  tenantId: string,
  branchId: string,
  productId: string,
  qtyBase: number,
  stockSource: SalesItem["stock_source"],
  reference: string,
  userId: string | null,
): Promise<void> {
  const bp = await tx.query.branchProducts.findFirst({
    where: and(
      eq(branchProducts.tenantId, tenantId),
      eq(branchProducts.branchId, branchId),
      eq(branchProducts.productId, productId),
    ),
  });
  if (!bp) throw new Error(`STOCK_DEFICIT: produk tidak ditemukan`);

  const isLegacy = stockSource === "legacy";
  const currentQty = num(isLegacy ? bp.legacyStock : bp.stock);
  if (currentQty + 1e-9 < qtyBase) throw new Error(`STOCK_DEFICIT: ${productId}`);

  const newQty = roundQty(currentQty - qtyBase);
  await tx
    .update(branchProducts)
    .set(
      isLegacy
        ? { legacyStock: stockStr(newQty) }
        : { stock: stockStr(newQty) },
    )
    .where(eq(branchProducts.id, bp.id));

  await tx.insert(stockMovements).values({
    tenantId,
    branchId,
    productId,
    type: isLegacy ? "legacy_out" : "out",
    stockSource,
    qty: stockStr(qtyBase),
    qtyBefore: stockStr(currentQty),
    qtyAfter: stockStr(newQty),
    reference,
    userId,
  });
}

function resolveItemQtyBase(item: SalesItemInsert): number {
  if (item.qty_base != null && Number.isFinite(Number(item.qty_base))) {
    return roundQty(Number(item.qty_base));
  }
  const factor = item.factor_to_base != null ? Number(item.factor_to_base) : 1;
  return toBaseQty(item.qty, factor > 0 ? factor : 1);
}

async function restoreStockInTx(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  tenantId: string,
  branchId: string,
  item: SalesItem,
  reference: string,
  userId: string | null,
): Promise<void> {
  if (!item.product_id) return;

  const base =
    item.qty_base != null && Number.isFinite(Number(item.qty_base))
      ? Number(item.qty_base)
      : item.qty;
  const restoreQty = Math.max(0, base - (item.qty_returned ?? 0));
  if (restoreQty <= 0) return;

  const bp = await tx.query.branchProducts.findFirst({
    where: and(
      eq(branchProducts.tenantId, tenantId),
      eq(branchProducts.branchId, branchId),
      eq(branchProducts.productId, item.product_id),
    ),
  });
  if (!bp) return;

  const isLegacy = item.stock_source === "legacy";
  const currentQty = num(isLegacy ? bp.legacyStock : bp.stock);
  const newQty = roundQty(currentQty + restoreQty);

  await tx
    .update(branchProducts)
    .set(
      isLegacy
        ? { legacyStock: stockStr(newQty) }
        : { stock: stockStr(newQty) },
    )
    .where(eq(branchProducts.id, bp.id));

  await tx.insert(stockMovements).values({
    tenantId,
    branchId,
    productId: item.product_id,
    type: isLegacy ? "legacy_in" : "in",
    stockSource: item.stock_source,
    qty: stockStr(restoreQty),
    qtyBefore: stockStr(currentQty),
    qtyAfter: stockStr(newQty),
    reference,
    notes: "Void transaksi — stok dikembalikan",
    userId,
  });
}

// ---------------------------------------------------------------------------
// Cashier sessions
// ---------------------------------------------------------------------------

export async function getOpenSession(
  tenantId: string,
  branchId: string,
  cashierId: string,
): Promise<CashierSession | null> {
  const db = getDb();
  const row = await db.query.cashierSessions.findFirst({
    where: and(
      eq(cashierSessions.tenantId, tenantId),
      eq(cashierSessions.branchId, branchId),
      eq(cashierSessions.cashierId, cashierId),
      eq(cashierSessions.status, "open"),
    ),
    orderBy: desc(cashierSessions.openedAt),
  });
  return row ? toCashierSession(row) : null;
}

export async function listSessions(
  tenantId: string,
  branchId: string,
  dateRange?: DateRangeFilter,
): Promise<CashierSession[]> {
  const db = getDb();
  const conditions = [
    eq(cashierSessions.tenantId, tenantId),
    eq(cashierSessions.branchId, branchId),
  ];
  if (dateRange?.from) {
    conditions.push(gte(cashierSessions.openedAt, new Date(dateRange.from)));
  }
  if (dateRange?.to) {
    conditions.push(lte(cashierSessions.openedAt, new Date(dateRange.to)));
  }
  const rows = await db.query.cashierSessions.findMany({
    where: and(...conditions),
    orderBy: desc(cashierSessions.openedAt),
  });
  return rows.map(toCashierSession);
}

export async function openSession(
  tenantId: string,
  payload: Omit<CashierSessionInsert, "tenant_id">,
): Promise<CashierSession> {
  const existing = await getOpenSession(tenantId, payload.branch_id, payload.cashier_id);
  if (existing) return existing;

  const db = getDb();
  const [row] = await db
    .insert(cashierSessions)
    .values({
      tenantId,
      branchId: payload.branch_id,
      cashierId: payload.cashier_id,
      status: payload.status ?? "open",
      openedAt: payload.opened_at ? new Date(payload.opened_at) : undefined,
      openingCashBalance: payload.opening_cash_balance,
      expectedCashBalance: payload.opening_cash_balance,
      actualCashBalance: payload.actual_cash_balance ?? null,
      notes: payload.notes ?? null,
    })
    .returning();
  return toCashierSession(row);
}

export async function closeSession(
  tenantId: string,
  sessionId: string,
  actualCashBalance: number,
  notes?: string,
): Promise<CashierSession | null> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const session = await tx.query.cashierSessions.findFirst({
      where: and(eq(cashierSessions.tenantId, tenantId), eq(cashierSessions.id, sessionId)),
    });
    if (!session || session.status === "closed") {
      return session ? toCashierSession(session) : null;
    }

    const discrepancy = actualCashBalance - session.expectedCashBalance;

    if (discrepancy !== 0) {
      let account = await tx.query.cashAccounts.findFirst({
        where: and(
          eq(cashAccounts.tenantId, tenantId),
          eq(cashAccounts.branchId, session.branchId),
          eq(cashAccounts.type, "cash"),
          eq(cashAccounts.isActive, true),
        ),
      });

      if (!account) {
        const [created] = await tx
          .insert(cashAccounts)
          .values({
            tenantId,
            branchId: session.branchId,
            name: "Kas Toko",
            type: "cash",
            balance: 0,
            isActive: true,
          })
          .returning();
        account = created!;
      }

      const isSurplus = discrepancy > 0;
      await insertCashTransactionInTx(tx, tenantId, session.branchId, account.id, {
        type: isSurplus ? "income" : "expense",
        category: "Selisih Kasir",
        amount: Math.abs(discrepancy),
        reference: `SHIFT-${sessionId.slice(0, 8)}`,
        description: isSurplus
          ? `Lebih kas saat tutup shift (+${Math.abs(discrepancy)})`
          : `Kurang kas saat tutup shift (-${Math.abs(discrepancy)})`,
        user_id: session.cashierId,
      });
    }

    const [row] = await tx
      .update(cashierSessions)
      .set({
        status: "closed",
        closedAt: new Date(),
        actualCashBalance,
        notes: notes ?? null,
      })
      .where(and(eq(cashierSessions.tenantId, tenantId), eq(cashierSessions.id, sessionId)))
      .returning();

    return row ? toCashierSession(row) : null;
  });
}

export interface ForceCloseBranchSessionsResult {
  closedCount: number;
  cancelledCarts: number;
}

/** Owner force-close — tutup semua sesi kasir terbuka saat menonaktifkan toko. */
export async function forceCloseAllOpenSessionsForBranch(
  tenantId: string,
  branchId: string,
  adminNote = "Ditutup otomatis saat penutupan toko (owner)",
): Promise<ForceCloseBranchSessionsResult> {
  const db = getDb();

  const openSessions = await db.query.cashierSessions.findMany({
    where: and(
      eq(cashierSessions.tenantId, tenantId),
      eq(cashierSessions.branchId, branchId),
      eq(cashierSessions.status, "open"),
    ),
  });

  if (openSessions.length === 0) {
    return { closedCount: 0, cancelledCarts: 0 };
  }

  const sessionIds = openSessions.map((s) => s.id);

  const cancelledCarts = await db
    .update(posCarts)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(posCarts.tenantId, tenantId),
        inArray(posCarts.sessionId, sessionIds),
        inArray(posCarts.status, ["active", "hold"]),
      ),
    )
    .returning();

  let closedCount = 0;
  for (const session of openSessions) {
    const [row] = await db
      .update(cashierSessions)
      .set({
        status: "closed",
        closedAt: new Date(),
        actualCashBalance: session.expectedCashBalance,
        notes: adminNote,
      })
      .where(and(eq(cashierSessions.tenantId, tenantId), eq(cashierSessions.id, session.id)))
      .returning();
    if (row) closedCount++;
  }

  return { closedCount, cancelledCarts: cancelledCarts.length };
}

// ---------------------------------------------------------------------------
// POS carts
// ---------------------------------------------------------------------------

export async function listActiveCarts(
  tenantId: string,
  sessionId: string,
): Promise<PosCart[]> {
  const db = getDb();
  const rows = await db.query.posCarts.findMany({
    where: and(
      eq(posCarts.tenantId, tenantId),
      eq(posCarts.sessionId, sessionId),
      inArray(posCarts.status, ["active", "hold"]),
    ),
    orderBy: posCarts.cartNumber,
  });
  return rows.map(toPosCart);
}

export async function createCart(
  tenantId: string,
  payload: Omit<PosCartInsert, "tenant_id">,
): Promise<PosCart> {
  const db = getDb();
  const [row] = await db
    .insert(posCarts)
    .values({
      tenantId,
      branchId: payload.branch_id,
      sessionId: payload.session_id,
      cashierId: payload.cashier_id,
      cartNumber: payload.cart_number,
      customerName: payload.customer_name,
      customerId: payload.customer_id,
      discountPercent: String(payload.discount_percent ?? 0),
      notes: payload.notes,
      status: payload.status ?? "active",
    })
    .returning();
  return toPosCart(row);
}

export async function listHeldCartsInBranch(
  tenantId: string,
  branchId: string,
  excludeCashierId: string,
): Promise<(PosCart & { cashier: Pick<typeof profiles.$inferSelect, "id" | "name"> | null })[]> {
  const db = getDb();
  const rows = await db
    .select({
      cart: posCarts,
      cashierId: profiles.id,
      cashierName: profiles.name,
    })
    .from(posCarts)
    .leftJoin(profiles, eq(posCarts.cashierId, profiles.id))
    .where(
      and(
        eq(posCarts.tenantId, tenantId),
        eq(posCarts.branchId, branchId),
        eq(posCarts.status, "hold"),
        ne(posCarts.cashierId, excludeCashierId),
      ),
    )
    .orderBy(desc(posCarts.updatedAt));

  return rows.map((r) => ({
    ...toPosCart(r.cart),
    cashier: r.cashierId ? { id: r.cashierId, name: r.cashierName ?? "" } : null,
  }));
}

export async function updateCartById(
  tenantId: string,
  cartId: string,
  updates: PosCartUpdate,
): Promise<PosCart | null> {
  const db = getDb();
  const patch: Partial<typeof posCarts.$inferInsert> = {};
  if (updates.customer_name !== undefined) patch.customerName = updates.customer_name;
  if (updates.customer_id !== undefined) patch.customerId = updates.customer_id;
  if (updates.discount_percent !== undefined) {
    patch.discountPercent = String(updates.discount_percent);
  }
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.cart_number !== undefined) patch.cartNumber = updates.cart_number;

  const [row] = await db
    .update(posCarts)
    .set(patch)
    .where(and(eq(posCarts.tenantId, tenantId), eq(posCarts.id, cartId)))
    .returning();
  return row ? toPosCart(row) : null;
}

// ---------------------------------------------------------------------------
// Sales transactions
// ---------------------------------------------------------------------------

export async function listTransactions(
  tenantId: string,
  branchId: string,
  options?: {
    dateRange?: DateRangeFilter;
    sessionId?: string;
    status?: SalesTransaction["status"];
    limit?: number;
  },
): Promise<SalesTransaction[]> {
  const db = getDb();
  const conditions = [
    eq(salesTransactions.tenantId, tenantId),
    eq(salesTransactions.branchId, branchId),
  ];
  if (options?.sessionId) conditions.push(eq(salesTransactions.sessionId, options.sessionId));
  if (options?.status) conditions.push(eq(salesTransactions.status, options.status));
  if (options?.dateRange?.from) {
    conditions.push(gte(salesTransactions.createdAt, new Date(options.dateRange.from)));
  }
  if (options?.dateRange?.to) {
    conditions.push(lte(salesTransactions.createdAt, new Date(options.dateRange.to)));
  }

  const rows = await db.query.salesTransactions.findMany({
    where: and(...conditions),
    orderBy: desc(salesTransactions.createdAt),
    limit: options?.limit,
  });
  return rows.map(toSalesTransaction);
}

export type SalesHistoryRow = SalesTransaction & {
  items: SalesItem[];
  branch_name: string;
  cashier_name: string;
};

export async function listSalesHistoryForBranches(
  tenantId: string,
  branchIds: string[],
  limit = 300,
): Promise<SalesHistoryRow[]> {
  if (branchIds.length === 0) return [];

  const db = getDb();
  const txRows = await db.query.salesTransactions.findMany({
    where: and(
      eq(salesTransactions.tenantId, tenantId),
      inArray(salesTransactions.branchId, branchIds),
    ),
    orderBy: desc(salesTransactions.createdAt),
    limit,
  });

  if (txRows.length === 0) return [];

  const txIds = txRows.map((r) => r.id);
  const itemRows = await db.query.salesItems.findMany({
    where: inArray(salesItems.transactionId, txIds),
  });

  const branchRows = await db.query.branches.findMany({
    where: and(eq(branches.tenantId, tenantId), inArray(branches.id, branchIds)),
  });
  const branchMap = new Map(branchRows.map((b) => [b.id, b.name]));

  const sessionIds = [...new Set(txRows.map((r) => r.sessionId))];
  const sessionRows = await db.query.cashierSessions.findMany({
    where: inArray(cashierSessions.id, sessionIds),
  });
  const cashierIds = [...new Set(sessionRows.map((s) => s.cashierId))];
  const profileRows =
    cashierIds.length > 0
      ? await db.query.profiles.findMany({ where: inArray(profiles.id, cashierIds) })
      : [];
  const cashierMap = new Map(profileRows.map((p) => [p.id, p.name]));
  const sessionCashierMap = new Map(
    sessionRows.map((s) => [s.id, cashierMap.get(s.cashierId) ?? "Kasir"]),
  );

  const itemsByTx = new Map<string, SalesItem[]>();
  for (const item of itemRows) {
    const mapped = toSalesItem(item);
    const list = itemsByTx.get(item.transactionId) ?? [];
    list.push(mapped);
    itemsByTx.set(item.transactionId, list);
  }

  return txRows.map((row) => {
    const tx = toSalesTransaction(row);
    return {
      ...tx,
      items: itemsByTx.get(row.id) ?? [],
      branch_name: branchMap.get(row.branchId) ?? "",
      cashier_name: sessionCashierMap.get(row.sessionId) ?? "Kasir",
    };
  });
}

export async function getTransactionById(
  tenantId: string,
  transactionId: string,
): Promise<(SalesTransaction & { items: SalesItem[] }) | null> {
  const db = getDb();
  const txRow = await db.query.salesTransactions.findFirst({
    where: and(
      eq(salesTransactions.tenantId, tenantId),
      eq(salesTransactions.id, transactionId),
    ),
  });
  if (!txRow) return null;

  const itemRows = await db.query.salesItems.findMany({
    where: eq(salesItems.transactionId, transactionId),
  });

  return {
    ...toSalesTransaction(txRow),
    items: itemRows.map(toSalesItem),
  };
}

export async function getTransactionByNumber(
  tenantId: string,
  txNumber: string,
): Promise<SalesTransaction | null> {
  const db = getDb();
  const row = await db.query.salesTransactions.findFirst({
    where: and(
      eq(salesTransactions.tenantId, tenantId),
      eq(salesTransactions.transactionNumber, txNumber),
    ),
  });
  return row ? toSalesTransaction(row) : null;
}

export async function getNextTransactionSequence(
  tenantId: string,
  branchId: string,
  date: Date,
): Promise<number> {
  return countDailyTransactions(getDb(), tenantId, branchId, date);
}

type DrizzleDb = ReturnType<typeof getDb>;

async function countDailyTransactions(
  db: DrizzleDb,
  tenantId: string,
  branchId: string,
  date: Date,
): Promise<number> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(salesTransactions)
    .where(
      and(
        eq(salesTransactions.tenantId, tenantId),
        eq(salesTransactions.branchId, branchId),
        gte(salesTransactions.createdAt, dayStart),
        lte(salesTransactions.createdAt, dayEnd),
      ),
    );

  return (result?.count ?? 0) + 1;
}

async function resolveTransactionNumber(
  db: DrizzleDb,
  tenantId: string,
  branchId: string,
  requested: string | undefined | null,
): Promise<string> {
  const trimmed = requested?.trim();
  if (trimmed) return trimmed;

  const branch = await db.query.branches.findFirst({
    where: and(eq(branches.tenantId, tenantId), eq(branches.id, branchId)),
  });
  if (!branch) throw new Error("Cabang tidak ditemukan");

  const now = new Date();
  let seq = await countDailyTransactions(db, tenantId, branchId, now);

  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = generateTransactionNumber(branch.code, now, seq);
    const taken = await db.query.salesTransactions.findFirst({
      where: and(
        eq(salesTransactions.tenantId, tenantId),
        eq(salesTransactions.transactionNumber, candidate),
      ),
      columns: { id: true },
    });
    if (!taken) return candidate;
    seq += 1;
  }

  throw new Error("Gagal menghasilkan nomor transaksi unik");
}

export async function createSaleTransaction(
  tenantId: string,
  transaction: Omit<SalesTransactionInsert, "tenant_id">,
  items: Omit<SalesItemInsert, "transaction_id" | "tenant_id">[],
  extras?: PosCheckoutExtras,
): Promise<SalesTransaction> {
  await ensurePosSchema();
  await ensureSellUnitsSchema();
  const { ensureCashflowSchema } = await import("@/server/db/ensure-cashflow-schema");
  await ensureCashflowSchema();
  const { assertTenantOperational } = await import("@/server/services/plan-limits");
  await assertTenantOperational(tenantId);
  const db = getDb();

  const clientTxId = nullIfEmptyUuid(transaction.client_tx_id ?? null);
  if (clientTxId) {
    const existing = await db.query.salesTransactions.findFirst({
      where: and(
        eq(salesTransactions.tenantId, tenantId),
        eq(salesTransactions.clientTxId, clientTxId),
      ),
    });
    if (existing) return toSalesTransaction(existing);
  }

  try {
    return await createSaleTransactionInner(
      db,
      tenantId,
      { ...transaction, client_tx_id: clientTxId },
      items,
      extras,
    );
  } catch (err) {
    throw new Error(formatDbError(err, "createSaleTransaction"));
  }
}

async function createSaleTransactionInner(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  transaction: Omit<SalesTransactionInsert, "tenant_id">,
  items: Omit<SalesItemInsert, "transaction_id" | "tenant_id">[],
  extras?: PosCheckoutExtras,
): Promise<SalesTransaction> {
  const saved = await db.transaction(async (tx) => {
    const transactionNumber = await resolveTransactionNumber(
      tx,
      tenantId,
      transaction.branch_id,
      transaction.transaction_number,
    );

    const session = await tx.query.cashierSessions.findFirst({
      where: and(
        eq(cashierSessions.tenantId, tenantId),
        eq(cashierSessions.id, transaction.session_id),
        eq(cashierSessions.status, "open"),
      ),
    });
    if (!session) throw new Error("Sesi kasir tidak ditemukan atau sudah ditutup");

    if (transaction.payment_method === "credit" && transaction.customer_id) {
      const customer = await tx.query.customers.findFirst({
        where: and(
          eq(customers.tenantId, tenantId),
          eq(customers.id, nullIfEmptyUuid(transaction.customer_id)!),
        ),
      });
      const creditDebt = transaction.grand_total - transaction.amount_paid;
      if (
        customer &&
        creditDebt > 0 &&
        customer.outstandingDebt + creditDebt > customer.creditLimit
      ) {
        throw new Error("CREDIT_EXCEEDED");
      }
    }

    for (const item of items) {
      if (!item.product_id || isSoLineItem(item)) continue;
      const bp = await tx.query.branchProducts.findFirst({
        where: and(
          eq(branchProducts.tenantId, tenantId),
          eq(branchProducts.branchId, transaction.branch_id),
          eq(branchProducts.productId, item.product_id),
        ),
      });
      if (!bp) throw new Error(`STOCK_DEFICIT: ${item.sku}`);
      const isLegacy = item.stock_source === "legacy";
      const currentQty = num(isLegacy ? bp.legacyStock : bp.stock);
      const need = resolveItemQtyBase(item);
      if (currentQty + 1e-9 < need) throw new Error(`STOCK_DEFICIT: ${item.sku}`);
    }

    const [txRow] = await tx
      .insert(salesTransactions)
      .values({
        tenantId,
        branchId: transaction.branch_id,
        sessionId: transaction.session_id,
        cartId: nullIfEmptyUuid(transaction.cart_id),
        transactionNumber,
        clientTxId: nullIfEmptyUuid(transaction.client_tx_id ?? null),
        customerId: nullIfEmptyUuid(transaction.customer_id),
        customerName: transaction.customer_name,
        subtotal: transaction.subtotal,
        discountAmount: transaction.discount_amount,
        taxAmount: transaction.tax_amount,
        grandTotal: transaction.grand_total,
        paymentMethod: transaction.payment_method,
        qrisProvider: transaction.qris_provider,
        amountPaid: transaction.amount_paid,
        changeAmount: transaction.change_amount,
        inputBy: nullIfEmptyUuid(transaction.input_by),
        paidBy: nullIfEmptyUuid(transaction.paid_by),
        isCrossSession: transaction.is_cross_session,
        hasLegacyItems: transaction.has_legacy_items,
        isOfflineTransaction: transaction.is_offline_transaction,
        offlineCreatedAt: transaction.offline_created_at
          ? new Date(transaction.offline_created_at)
          : null,
        syncStatus: transaction.sync_status,
        status: transaction.status ?? "completed",
        notes: transaction.notes,
        createdAt: transaction.created_at ? new Date(transaction.created_at) : undefined,
      })
      .returning();

    if (items.length > 0) {
      await tx.insert(salesItems).values(
        items.map((item) => {
          const factor =
            item.factor_to_base != null && Number(item.factor_to_base) > 0
              ? Number(item.factor_to_base)
              : 1;
          const qtyBase = resolveItemQtyBase(item);
          return {
            transactionId: txRow.id,
            tenantId,
            productId: nullIfEmptyUuid(item.product_id),
            productName: item.product_name,
            sku: item.sku,
            unit: item.unit,
            qty: stockStr(item.qty),
            purchasePrice: item.purchase_price,
            sellingPrice: item.selling_price,
            discount: item.discount,
            subtotal: item.subtotal,
            stockSource: item.stock_source,
            isSoLine: item.is_so_line === true,
            sellUnitId: nullIfEmptyUuid(item.sell_unit_id ?? null),
            sellUnitLabel: item.sell_unit_label ?? null,
            qtyBase: stockStr(qtyBase),
            factorToBase: stockStr(factor),
          };
        }),
      );
    }

    for (const item of items) {
      if (!item.product_id || isSoLineItem(item)) continue;
      await deductStockInTx(
        tx,
        tenantId,
        transaction.branch_id,
        item.product_id,
        resolveItemQtyBase(item),
        item.stock_source,
        transactionNumber,
        transaction.paid_by,
      );
    }

    if (transaction.payment_method === "credit" && transaction.customer_id) {
      const creditDebt = transaction.grand_total - transaction.amount_paid;
      if (creditDebt > 0) {
        await tx
          .update(customers)
          .set({
            outstandingDebt: sql`${customers.outstandingDebt} + ${creditDebt}`,
          })
          .where(
            and(eq(customers.tenantId, tenantId), eq(customers.id, transaction.customer_id)),
          );

        const { createReceivableFromCreditSale } = await import(
          "@/server/services/receivables"
        );
        await createReceivableFromCreditSale(tx, tenantId, {
          branchId: transaction.branch_id,
          customerId: transaction.customer_id,
          customerName: transaction.customer_name ?? "Pelanggan Kredit",
          salesTransactionId: txRow.id,
          invoiceNumber: `AR-${transactionNumber}`,
          amount: creditDebt,
        });
      }
    }

    const deltas = computeSessionDeltas(
      transaction.payment_method,
      transaction.grand_total,
      transaction.amount_paid,
    );

    await tx
      .update(cashierSessions)
      .set({
        totalSales: sql`${cashierSessions.totalSales} + ${deltas.totalSales}`,
        totalTransactions: sql`${cashierSessions.totalTransactions} + ${deltas.totalTransactions}`,
        totalCashSales: sql`${cashierSessions.totalCashSales} + ${deltas.totalCashSales}`,
        totalCardSales: sql`${cashierSessions.totalCardSales} + ${deltas.totalCardSales}`,
        totalTransferSales: sql`${cashierSessions.totalTransferSales} + ${deltas.totalTransferSales}`,
        totalCreditSales: sql`${cashierSessions.totalCreditSales} + ${deltas.totalCreditSales}`,
        expectedCashBalance: sql`${cashierSessions.expectedCashBalance} + ${deltas.expectedCashDelta}`,
      })
      .where(eq(cashierSessions.id, session.id));

    const sale = toSalesTransaction(txRow);

    const { applyPosCheckoutSideEffectsInTx } = await import(
      "@/server/services/pos-checkout-side-effects"
    );
    await applyPosCheckoutSideEffectsInTx(
      tx,
      tenantId,
      transaction.branch_id,
      sale,
      extras,
      nullIfEmptyUuid(transaction.paid_by),
    );

    if (extras?.returnOffset) {
      const { finalizeReturnOffsetInTx } = await import("@/server/services/sales-returns");
      await finalizeReturnOffsetInTx(
        tx,
        tenantId,
        extras.returnOffset.returnId,
        transaction.paid_by ?? "",
        txRow.id,
        extras.returnOffset.offsetAmount,
      );
    }

    return sale;
  });

  await invalidateBranchProducts(tenantId, transaction.branch_id);
  if (transaction.payment_method === "credit" && transaction.customer_id) {
    await invalidateCustomers(tenantId);
  }
  return saved;
}

const VOID_BLOCKED_RETURN_STATUSES = [
  "pending_qc",
  "qc_completed",
  "pending_approval",
  "pending_offset",
] as const;

export async function voidSaleTransaction(
  tenantId: string,
  transactionId: string,
  userId: string,
): Promise<SalesTransaction | null> {
  const db = getDb();

  const voided = await db.transaction(async (tx) => {
    const txRow = await tx.query.salesTransactions.findFirst({
      where: and(
        eq(salesTransactions.tenantId, tenantId),
        eq(salesTransactions.id, transactionId),
      ),
    });
    if (!txRow || txRow.status === "voided") {
      return txRow ? toSalesTransaction(txRow) : null;
    }

    if (txRow.returnStatus !== "none") {
      throw new Error("VOID_BLOCKED: transaksi sudah memiliki retur");
    }

    const activeReturns = await tx.query.salesReturns.findMany({
      where: and(
        eq(salesReturns.originalTransactionId, transactionId),
        inArray(salesReturns.status, [...VOID_BLOCKED_RETURN_STATUSES]),
      ),
    });
    if (activeReturns.length > 0) {
      throw new Error("VOID_BLOCKED: masih ada retur aktif pada transaksi ini");
    }

    const completedReturns = await tx.query.salesReturns.findFirst({
      where: and(
        eq(salesReturns.originalTransactionId, transactionId),
        eq(salesReturns.status, "completed"),
      ),
    });
    if (completedReturns) {
      throw new Error("VOID_BLOCKED: transaksi sudah memiliki retur selesai");
    }

    const itemRows = await tx.query.salesItems.findMany({
      where: eq(salesItems.transactionId, transactionId),
    });
    const items = itemRows.map(toSalesItem);

    for (const item of items) {
      if (item.is_so_line) continue;
      await restoreStockInTx(
        tx,
        tenantId,
        txRow.branchId,
        item,
        txRow.transactionNumber,
        userId,
      );
    }

    if (txRow.paymentMethod === "credit" && txRow.customerId) {
      const creditDebt = txRow.grandTotal - txRow.amountPaid;
      if (creditDebt > 0) {
        await tx
          .update(customers)
          .set({
            outstandingDebt: sql`GREATEST(0, ${customers.outstandingDebt} - ${creditDebt})`,
          })
          .where(and(eq(customers.tenantId, tenantId), eq(customers.id, txRow.customerId)));
      }

      const { voidReceivableForSaleInTx } = await import("@/server/services/receivables");
      await voidReceivableForSaleInTx(tx, tenantId, transactionId);
    }

    const saleForCash = toSalesTransaction(txRow);
    await reversePosSaleCashBookInTx(
      tx,
      tenantId,
      txRow.branchId,
      saleForCash,
      userId,
    );

    const reverse = computeSessionDeltas(txRow.paymentMethod, txRow.grandTotal, txRow.amountPaid);

    await tx
      .update(cashierSessions)
      .set({
        totalSales: sql`GREATEST(0, ${cashierSessions.totalSales} - ${reverse.totalSales})`,
        totalTransactions: sql`GREATEST(0, ${cashierSessions.totalTransactions} - 1)`,
        totalCashSales: sql`GREATEST(0, ${cashierSessions.totalCashSales} - ${reverse.totalCashSales})`,
        totalCardSales: sql`GREATEST(0, ${cashierSessions.totalCardSales} - ${reverse.totalCardSales})`,
        totalTransferSales: sql`GREATEST(0, ${cashierSessions.totalTransferSales} - ${reverse.totalTransferSales})`,
        totalCreditSales: sql`GREATEST(0, ${cashierSessions.totalCreditSales} - ${reverse.totalCreditSales})`,
        expectedCashBalance: sql`GREATEST(0, ${cashierSessions.expectedCashBalance} - ${reverse.expectedCashDelta})`,
      })
      .where(eq(cashierSessions.id, txRow.sessionId));

    const [updated] = await tx
      .update(salesTransactions)
      .set({ status: "voided" })
      .where(eq(salesTransactions.id, transactionId))
      .returning();

    return updated ? toSalesTransaction(updated) : null;
  });

  if (voided) {
    await invalidateBranchProducts(tenantId, voided.branch_id);
    if (voided.payment_method === "credit" && voided.customer_id) {
      await invalidateCustomers(tenantId);
    }
    const { recordAuditEvent } = await import("@/server/services/audit-log");
    const { getClientIp } = await import("@/server/rate-limit");
    await recordAuditEvent({
      tenantId,
      actorId: userId,
      action: "void_sale",
      entityType: "sales_transaction",
      entityId: transactionId,
      metadata: {
        transactionNumber: voided.transaction_number,
        branchId: voided.branch_id,
        grandTotal: voided.grand_total,
      },
      ipAddress: await getClientIp(),
    });
  }
  return voided;
}

// =============================================================================
// Neon RPC — Phase 3 (POS sessions, carts, sales transactions)
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type { DateRangeFilter } from "@/types/app";
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

async function requireTenant(tenantId: string) {
  const { assertTenant, requireRequestSession } = await import("@/server/auth/request-session");
  const session = await requireRequestSession();
  assertTenant(session, tenantId);
  return session;
}

export const neonGetOpenSession = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string; cashierId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getOpenSession } = await import("@/server/services/transactions");
    return getOpenSession(data.tenantId, data.branchId, data.cashierId);
  });

export const neonGetSessions = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; branchId: string; dateRange?: DateRangeFilter }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listSessions } = await import("@/server/services/transactions");
    return listSessions(data.tenantId, data.branchId, data.dateRange);
  });

export const neonOpenSession = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; payload: Omit<CashierSessionInsert, "tenant_id"> }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { openSession } = await import("@/server/services/transactions");
    return openSession(data.tenantId, data.payload);
  });

export const neonCloseSession = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      sessionId: string;
      actualCashBalance: number;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { closeSession } = await import("@/server/services/transactions");
    const session = await closeSession(
      data.tenantId,
      data.sessionId,
      data.actualCashBalance,
      data.notes,
    );
    if (!session) throw new Error("Sesi tidak ditemukan");
    return session;
  });

export const neonGetActiveCarts = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; sessionId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listActiveCarts } = await import("@/server/services/transactions");
    return listActiveCarts(data.tenantId, data.sessionId);
  });

export const neonCreateCart = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; payload: Omit<PosCartInsert, "tenant_id"> }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createCart } = await import("@/server/services/transactions");
    return createCart(data.tenantId, data.payload);
  });

export const neonGetHeldCartsInBranch = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; branchId: string; excludeCashierId: string }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listHeldCartsInBranch } = await import("@/server/services/transactions");
    return listHeldCartsInBranch(
      data.tenantId,
      data.branchId,
      data.excludeCashierId,
    );
  });

export const neonUpdateCart = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; cartId: string; updates: PosCartUpdate }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { updateCartById } = await import("@/server/services/transactions");
    const cart = await updateCartById(data.tenantId, data.cartId, data.updates);
    if (!cart) throw new Error("Keranjang tidak ditemukan");
    return cart;
  });

export const neonGetTransactions = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId: string;
      options?: {
        dateRange?: DateRangeFilter;
        sessionId?: string;
        status?: SalesTransaction["status"];
        limit?: number;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listTransactions } = await import("@/server/services/transactions");
    return listTransactions(data.tenantId, data.branchId, data.options);
  });

export const neonGetTransaction = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; transactionId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getTransactionById } = await import("@/server/services/transactions");
    const tx = await getTransactionById(data.tenantId, data.transactionId);
    if (!tx) throw new Error("Transaksi tidak ditemukan");
    return tx;
  });

export const neonGetTransactionByNumber = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; txNumber: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getTransactionByNumber } = await import("@/server/services/transactions");
    const tx = await getTransactionByNumber(data.tenantId, data.txNumber);
    if (!tx) throw new Error("Transaksi tidak ditemukan");
    return tx;
  });

export const neonGetNextTransactionSequence = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; branchId: string; dateIso: string }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getNextTransactionSequence } = await import("@/server/services/transactions");
    return getNextTransactionSequence(
      data.tenantId,
      data.branchId,
      new Date(data.dateIso),
    );
  });

export const neonCreateTransaction = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      transaction: Omit<SalesTransactionInsert, "tenant_id">;
      items: Omit<SalesItemInsert, "transaction_id" | "tenant_id">[];
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createSaleTransaction } = await import("@/server/services/transactions");
    return createSaleTransaction(data.tenantId, data.transaction, data.items);
  });

export const neonVoidTransaction = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; transactionId: string; userId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { voidSaleTransaction } = await import("@/server/services/transactions");
    const tx = await voidSaleTransaction(data.tenantId, data.transactionId, data.userId);
    if (!tx) throw new Error("Transaksi tidak ditemukan");
    return tx;
  });

export const neonListSalesHistory = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchIds: string[]; limit?: number }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listSalesHistoryForBranches } = await import("@/server/services/transactions");
    return listSalesHistoryForBranches(data.tenantId, data.branchIds, data.limit);
  });

export type NeonHeldCart = PosCart & {
  cashier: { id: string; name: string } | null;
};

export type NeonTransactionWithItems = SalesTransaction & { items: SalesItem[] };

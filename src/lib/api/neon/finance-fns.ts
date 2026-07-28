// =============================================================================
// Neon RPC — Phase 4 (finance, receivables, payables)
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type { DateRangeFilter } from "@/types/app";
import type {
  AccountPayable,
  AccountPayableInsert,
  AccountReceivable,
  AccountReceivableInsert,
  ApPaymentInsert,
  ArPaymentInsert,
  CashAccount,
  CashAccountInsert,
  CashAccountUpdate,
  CashTransaction,
  CashTransactionInsert,
} from "@/types/database";

async function requireTenant(tenantId: string) {
  const { assertTenant, requireRequestSession } = await import("@/server/auth/request-session");
  const session = await requireRequestSession();
  assertTenant(session, tenantId);
  return session;
}

// --- Finance ---

export const neonGetCashAccounts = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId?: string;
      options?: { activeOnly?: boolean; type?: "cash" | "bank" };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listCashAccounts } = await import("@/server/services/finance");
    return listCashAccounts(data.tenantId, data.branchId, data.options);
  });

export const neonGetCashAccount = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; accountId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getCashAccountById } = await import("@/server/services/finance");
    const account = await getCashAccountById(data.tenantId, data.accountId);
    if (!account) throw new Error("Akun kas tidak ditemukan");
    return account;
  });

export const neonCreateCashAccount = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; payload: Omit<CashAccountInsert, "tenant_id"> }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createCashAccount } = await import("@/server/services/finance");
    return createCashAccount(data.tenantId, data.payload);
  });

export const neonUpdateCashAccount = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; accountId: string; updates: CashAccountUpdate }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { updateCashAccountById } = await import("@/server/services/finance");
    const account = await updateCashAccountById(data.tenantId, data.accountId, data.updates);
    if (!account) throw new Error("Akun kas tidak ditemukan");
    return account;
  });

export const neonGetCashTransactions = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId: string;
      options?: {
        accountId?: string;
        type?: CashTransaction["type"];
        dateRange?: DateRangeFilter;
        limit?: number;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listCashTransactions } = await import("@/server/services/finance");
    return listCashTransactions(data.tenantId, data.branchId, data.options);
  });

export const neonRecordCashTransaction = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId: string;
      accountId: string;
      tx: Omit<CashTransactionInsert, "tenant_id" | "branch_id" | "cash_account_id">;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { recordCashTransaction } = await import("@/server/services/finance");
    return recordCashTransaction(data.tenantId, data.branchId, data.accountId, data.tx);
  });

export const neonGetBranchCashSummary = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getBranchCashSummary } = await import("@/server/services/finance");
    return getBranchCashSummary(data.tenantId, data.branchId);
  });

export const neonGetFinanceOverview = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchIds: string[];
      options?: {
        txLimit?: number;
        dateRange?: DateRangeFilter;
        includeAr?: boolean;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { assertServerFnRateLimit } = await import("@/server/server-fn-rate-limit");
    await assertServerFnRateLimit("finance-overview", data.tenantId);
    const { getFinanceOverviewReport } = await import("@/server/services/finance-overview");
    return getFinanceOverviewReport(data.tenantId, data.branchIds, data.options);
  });

// --- Receivables ---

export const neonGetReceivables = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId?: string;
      options?: {
        status?: AccountReceivable["status"];
        customerId?: string;
        overdueOnly?: boolean;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listReceivables } = await import("@/server/services/receivables");
    return listReceivables(data.tenantId, data.branchId, data.options);
  });

export const neonGetReceivable = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; arId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getReceivableById } = await import("@/server/services/receivables");
    const ar = await getReceivableById(data.tenantId, data.arId);
    if (!ar) throw new Error("Piutang tidak ditemukan");
    return ar;
  });

export const neonCreateReceivable = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; payload: Omit<AccountReceivableInsert, "tenant_id"> }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createReceivable } = await import("@/server/services/receivables");
    return createReceivable(data.tenantId, data.payload);
  });

export const neonRecordArPayment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      arId: string;
      payment: Omit<ArPaymentInsert, "tenant_id" | "ar_id">;
      options?: { cashAccountId?: string; branchId?: string };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { recordArPayment } = await import("@/server/services/receivables");
    return recordArPayment(data.tenantId, data.arId, data.payment, data.options);
  });

export const neonGetArPayments = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; arId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listArPayments } = await import("@/server/services/receivables");
    return listArPayments(data.tenantId, data.arId);
  });

export const neonRefreshOverdueReceivables = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { refreshOverdueReceivables } = await import("@/server/services/receivables");
    await refreshOverdueReceivables(data.tenantId);
    return null;
  });

export const neonGetArSummary = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId?: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getArSummary } = await import("@/server/services/receivables");
    return getArSummary(data.tenantId, data.branchId);
  });

// --- Payables ---

export const neonGetPayables = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId?: string;
      options?: { status?: AccountPayable["status"]; supplierId?: string };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listPayables } = await import("@/server/services/payables");
    return listPayables(data.tenantId, data.branchId, data.options);
  });

export const neonGetPayable = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; apId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getPayableById } = await import("@/server/services/payables");
    const ap = await getPayableById(data.tenantId, data.apId);
    if (!ap) throw new Error("Hutang tidak ditemukan");
    return ap;
  });

export const neonCreatePayable = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; payload: Omit<AccountPayableInsert, "tenant_id"> }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createPayable } = await import("@/server/services/payables");
    return createPayable(data.tenantId, data.payload);
  });

export const neonRecordApPayment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      apId: string;
      payment: Omit<ApPaymentInsert, "tenant_id" | "ap_id">;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { recordApPayment } = await import("@/server/services/payables");
    return recordApPayment(data.tenantId, data.apId, data.payment);
  });

export const neonGetApSummary = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId?: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getApSummary } = await import("@/server/services/payables");
    return getApSummary(data.tenantId, data.branchId);
  });

export const neonRefreshOverduePayables = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { refreshOverduePayables } = await import("@/server/services/payables");
    await refreshOverduePayables(data.tenantId);
    return null;
  });

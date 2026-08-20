// =============================================================================
// useReceivablesPage — AR list scoped per cabang (Fase 12).
// =============================================================================

import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useFinanceStore } from "@/stores/finance.store";
import { useReceivablesStore, type RecordArPaymentDraft } from "@/stores/receivables.store";
import { useCustomersStore } from "@/stores/customers.store";
import { usePosStore } from "@/stores/pos.store";
import { isMockTenantId } from "@/lib/mock-session";
import { isNeonBackend } from "@/lib/api/backend";
import { getReceivables, recordArPayment } from "@/lib/api/receivables";
import { getCashAccounts } from "@/lib/api/finance";
import { todayKeyInAppTz } from "@/lib/app-timezone";
import type { AccountReceivable } from "@/types/database";
import type { Receivable } from "@/lib/mock-data";
import { toast } from "sonner";
import {
  computeAgingBuckets,
  filterByBranchIds,
  getArApStatus,
  remainingAmount,
} from "@/lib/ar-ap-utils";
import { filterFinanceByBranches, getFinanceScopeLabel } from "@/lib/finance-scope";
import { resolveScopedBranchIds } from "@/lib/branch-scope";

export function useReceivablesPage() {
  const user = useAuthStore((s) => s.currentUser?.profile);
  const branches = useBranchStore((s) => s.branches);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const receivables = useReceivablesStore((s) => s.mockReceivables);
  const payments = useReceivablesStore((s) => s.mockPayments);
  const recordMockPaymentRaw = useReceivablesStore((s) => s.recordMockPayment);
  const cashAccounts = useFinanceStore((s) => s.mockCashAccounts);
  const customers = useCustomersStore((s) => s.customers);
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const isMockTenant = isMockTenantId(tenantId);
  const queryClient = useQueryClient();

  const isOwner = user?.role === "owner";
  const branchIds = useMemo(
    () =>
      resolveScopedBranchIds({
        branches,
        activeBranch,
        isConsolidated,
        isOwner,
      }),
    [isConsolidated, isOwner, branches, activeBranch],
  );

  const scopeLabel = getFinanceScopeLabel(isConsolidated && isOwner, activeBranch);
  const branchNameById = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
    [branches],
  );

  const neonArQuery = useQuery({
    queryKey: ["receivables", tenantId, branchIds.join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        branchIds.map((id) => getReceivables(tenantId, id)),
      );
      const rows: AccountReceivable[] = [];
      for (const r of results) {
        if (r.error) throw new Error(r.error);
        rows.push(...(r.data ?? []));
      }
      return rows;
    },
    enabled: isNeonBackend() && !isMockTenant && Boolean(tenantId) && branchIds.length > 0,
  });

  const neonAccountsQuery = useQuery({
    queryKey: ["cash-accounts-ar", tenantId, branchIds.join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        branchIds.map((id) => getCashAccounts(tenantId, id, { activeOnly: true })),
      );
      return results.flatMap((r) => r.data ?? []);
    },
    enabled: isNeonBackend() && !isMockTenant && Boolean(tenantId) && branchIds.length > 0,
  });

  const neonReceivables: Receivable[] = useMemo(
    () =>
      (neonArQuery.data ?? []).map((r) => ({
        id: r.id,
        customerId: r.customer_id,
        branchId: r.branch_id,
        invoice: r.invoice_number,
        amount: r.total_amount,
        paid: r.paid_amount,
        dueDate: r.due_date,
        issuedDate: r.created_at,
        salesTransactionId: r.sales_transaction_id,
        salesOrderId: r.sales_order_id,
      })),
    [neonArQuery.data],
  );

  const scopedReceivables = useMemo(
    () =>
      isMockTenant ? filterByBranchIds(receivables, branchIds) : neonReceivables,
    [isMockTenant, receivables, branchIds, neonReceivables],
  );

  const scopedPayments = useMemo(
    () => filterByBranchIds(payments, branchIds),
    [payments, branchIds],
  );

  const totalOutstanding = useMemo(
    () => scopedReceivables.reduce((s, r) => s + remainingAmount(r.amount, r.paid), 0),
    [scopedReceivables],
  );

  const overdueOutstanding = useMemo(
    () =>
      scopedReceivables
        .filter((r) => getArApStatus(r.amount, r.paid, r.dueDate) === "overdue")
        .reduce((s, r) => s + remainingAmount(r.amount, r.paid), 0),
    [scopedReceivables],
  );

  const agingBuckets = useMemo(
    () =>
      computeAgingBuckets(
        scopedReceivables.map((r) => ({
          amount: r.amount,
          paid: r.paid,
          dueDate: r.dueDate,
        })),
      ),
    [scopedReceivables],
  );

  const scopedCashAccounts = useMemo(
    () =>
      isMockTenant
        ? filterFinanceByBranches(cashAccounts, branchIds)
        : (neonAccountsQuery.data ?? []),
    [isMockTenant, cashAccounts, branchIds, neonAccountsQuery.data],
  );

  const customerNameById = useMemo(() => {
    const fromStore = Object.fromEntries(
      customers.filter((c) => c.tenant_id === tenantId).map((c) => [c.id, c.name]),
    );
    for (const row of neonArQuery.data ?? []) {
      fromStore[row.customer_id] = row.customer_name;
    }
    return fromStore;
  }, [customers, tenantId, neonArQuery.data]);

  const recordMockPayment = useCallback(
    (draft: RecordArPaymentDraft) => {
      if (!isMockTenant) {
        const rec = neonReceivables.find((r) => r.id === draft.receivable_id);
        void (async () => {
          const result = await recordArPayment(
            tenantId,
            draft.receivable_id,
            {
              amount: draft.amount,
              payment_date: todayKeyInAppTz(),
              payment_method: draft.payment_method ?? "cash",
              notes: null,
              user_id: draft.user_id,
            },
            { cashAccountId: draft.cash_account_id, branchId: rec?.branchId ?? activeBranch?.id },
          );
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Pembayaran piutang dicatat");
          await queryClient.invalidateQueries({ queryKey: ["receivables", tenantId] });
          await queryClient.invalidateQueries({ queryKey: ["finance-overview", tenantId] });
          await queryClient.invalidateQueries({ queryKey: ["cashflow-vs-accrual"] });
          await queryClient.invalidateQueries({ queryKey: ["cashflow-kpis"] });
        })();
        return { ok: true as const };
      }
      const result = recordMockPaymentRaw(draft);
      if (result.ok) {
        const receivable = receivables.find((r) => r.id === draft.receivable_id);
        if (receivable) {
          usePosStore.getState().adjustMockCustomerDebtDelta(receivable.customerId, -draft.amount);
        }
      }
      return result;
    },
    [
      isMockTenant,
      tenantId,
      activeBranch?.id,
      queryClient,
      recordMockPaymentRaw,
      neonReceivables,
    ],
  );

  return {
    user,
    isConsolidated: isConsolidated && isOwner,
    scopeLabel,
    branchNameById,
    receivables: scopedReceivables,
    payments: scopedPayments,
    totalOutstanding,
    overdueOutstanding,
    agingBuckets,
    customerNameById,
    cashAccounts: scopedCashAccounts,
    recordMockPayment,
  };
}

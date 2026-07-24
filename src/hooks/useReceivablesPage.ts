// =============================================================================
// useReceivablesPage — AR list scoped per cabang (Fase 12).
// =============================================================================

import { useMemo, useCallback } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useFinanceStore } from "@/stores/finance.store";
import { useReceivablesStore, type RecordArPaymentDraft } from "@/stores/receivables.store";
import { useCustomersStore } from "@/stores/customers.store";
import { usePosStore } from "@/stores/pos.store";
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

  const scopedReceivables = useMemo(
    () => filterByBranchIds(receivables, branchIds),
    [receivables, branchIds],
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
    () => filterFinanceByBranches(cashAccounts, branchIds),
    [cashAccounts, branchIds],
  );

  const customerNameById = useMemo(
    () =>
      Object.fromEntries(
        customers.filter((c) => c.tenant_id === tenantId).map((c) => [c.id, c.name]),
      ),
    [customers, tenantId],
  );

  const recordMockPayment = useCallback(
    (draft: RecordArPaymentDraft) => {
      const result = recordMockPaymentRaw(draft);
      if (result.ok) {
        const receivable = receivables.find((r) => r.id === draft.receivable_id);
        if (receivable) {
          usePosStore.getState().adjustMockCustomerDebtDelta(receivable.customerId, -draft.amount);
        }
      }
      return result;
    },
    [recordMockPaymentRaw, receivables],
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

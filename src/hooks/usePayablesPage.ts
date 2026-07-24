// =============================================================================
// usePayablesPage — AP list scoped per cabang (Fase 12).
// =============================================================================

import { useMemo } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useFinanceStore } from "@/stores/finance.store";
import { usePayablesStore } from "@/stores/payables.store";
import { SUPPLIERS } from "@/lib/mock-data";
import {
  computeAgingBuckets,
  filterByBranchIds,
  getArApStatus,
  remainingAmount,
} from "@/lib/ar-ap-utils";
import { filterFinanceByBranches, getFinanceScopeLabel } from "@/lib/finance-scope";
import { resolveScopedBranchIds } from "@/lib/branch-scope";

export function usePayablesPage() {
  const user = useAuthStore((s) => s.currentUser?.profile);
  const branches = useBranchStore((s) => s.branches);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const payables = usePayablesStore((s) => s.mockPayables);
  const payments = usePayablesStore((s) => s.mockPayments);
  const recordMockPayment = usePayablesStore((s) => s.recordMockPayment);
  const cashAccounts = useFinanceStore((s) => s.mockCashAccounts);

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

  const scopedPayables = useMemo(
    () => filterByBranchIds(payables, branchIds),
    [payables, branchIds],
  );

  const scopedPayments = useMemo(
    () => filterByBranchIds(payments, branchIds),
    [payments, branchIds],
  );

  const scopedCashAccounts = useMemo(
    () => filterFinanceByBranches(cashAccounts, branchIds),
    [cashAccounts, branchIds],
  );

  const totalOutstanding = useMemo(
    () => scopedPayables.reduce((s, p) => s + remainingAmount(p.amount, p.paid), 0),
    [scopedPayables],
  );

  const overdueOutstanding = useMemo(
    () =>
      scopedPayables
        .filter((p) => getArApStatus(p.amount, p.paid, p.dueDate) === "overdue")
        .reduce((s, p) => s + remainingAmount(p.amount, p.paid), 0),
    [scopedPayables],
  );

  const agingBuckets = useMemo(
    () =>
      computeAgingBuckets(
        scopedPayables.map((p) => ({
          amount: p.amount,
          paid: p.paid,
          dueDate: p.dueDate,
        })),
      ),
    [scopedPayables],
  );

  const supplierNameById = useMemo(
    () => Object.fromEntries(SUPPLIERS.map((s) => [s.id, s.name])),
    [],
  );

  return {
    user,
    isConsolidated: isConsolidated && isOwner,
    scopeLabel,
    branchNameById,
    payables: scopedPayables,
    payments: scopedPayments,
    cashAccounts: scopedCashAccounts,
    totalOutstanding,
    overdueOutstanding,
    agingBuckets,
    supplierNameById,
    recordMockPayment,
  };
}

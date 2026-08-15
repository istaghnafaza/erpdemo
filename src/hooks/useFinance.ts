// =============================================================================
// useFinance — dashboard keuangan (Fase 11).
// =============================================================================

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { isMockTenantId } from "@/lib/mock-session";
import { useBranchStore } from "@/stores/branch.store";
import { useFinanceStore } from "@/stores/finance.store";
import { useReceivablesStore } from "@/stores/receivables.store";
import { usePayablesStore } from "@/stores/payables.store";
import { useSalesTransactionsStore } from "@/stores/sales-transactions.store";
import { fetchFinanceOverview } from "@/lib/finance-overview-client";
import { queryKeys } from "@/lib/query-keys";
import {
  computeCashFlowSeries,
  computeProfitLoss,
  getMonthDateRange,
} from "@/lib/finance-calculations";
import { computeReceivablesSummary } from "@/lib/receivables-calculations";
import { filterFinanceByBranches, getFinanceScopeLabel } from "@/lib/finance-scope";
import { resolveScopedBranchIds } from "@/lib/branch-scope";

export interface FinanceBranchSummary {
  branchId: string;
  branchName: string;
  totalBalance: number;
  sales: number;
  netProfit: number;
  receivablesOutstanding: number;
}

export function useFinance() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const branches = useBranchStore((s) => s.branches);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const mockAccounts = useFinanceStore((s) => s.mockCashAccounts);
  const mockTransactions = useFinanceStore((s) => s.mockCashTransactions);
  const mockReceivables = useReceivablesStore((s) => s.mockReceivables);
  const mockArPayments = useReceivablesStore((s) => s.mockPayments);
  const mockPayables = usePayablesStore((s) => s.mockPayables);
  const mockApPayments = usePayablesStore((s) => s.mockPayments);
  const mockSales = useSalesTransactionsStore((s) => s.transactions);
  const initializeMockFinance = useFinanceStore((s) => s.initializeMockFinance);
  const syncHistoricalArApPayments = useFinanceStore((s) => s.syncHistoricalArApPayments);

  const tenantId = currentUser?.tenantId ?? "";
  const tenantSlug = useAuthStore((s) => s.currentTenant?.slug) ?? "";
  const isMockTenant = isMockTenantId(tenantId);
  const isOwner = currentUser?.profile.role === "owner";

  useEffect(() => {
    if (!isMockTenant) return;
    initializeMockFinance(mockSales);
    syncHistoricalArApPayments({
      receivables: mockReceivables,
      arPayments: mockArPayments,
      payables: mockPayables,
      apPayments: mockApPayments,
    });
  }, [
    isMockTenant,
    mockSales,
    mockReceivables,
    mockArPayments,
    mockPayables,
    mockApPayments,
    initializeMockFinance,
    syncHistoricalArApPayments,
  ]);

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

  const financeQuery = useQuery({
    queryKey: queryKeys.financeOverview(tenantId, branchIds),
    queryFn: () => fetchFinanceOverview(tenantId, branchIds),
    enabled: !isMockTenant && Boolean(tenantId) && branchIds.length > 0,
    staleTime: 60_000,
  });

  const mockScopedAccounts = useMemo(
    () => filterFinanceByBranches(mockAccounts, branchIds),
    [mockAccounts, branchIds],
  );

  const mockScopedTransactions = useMemo(
    () => filterFinanceByBranches(mockTransactions, branchIds),
    [mockTransactions, branchIds],
  );

  const mockScopedSales = useMemo(
    () =>
      isMockTenant
        ? mockSales.filter(
            (s) =>
              s.tenantId === tenantId &&
              s.status === "completed" &&
              (branchIds.length === 0 || branchIds.includes(s.branchId)),
          )
        : [],
    [isMockTenant, mockSales, tenantId, branchIds],
  );

  const apiAccounts = financeQuery.data?.accounts ?? [];
  const apiTransactions = financeQuery.data?.transactions ?? [];
  const apiReceivablesSummary = financeQuery.data?.receivablesSummary ?? null;

  const loading = isMockTenant ? false : financeQuery.isPending;

  const accounts = isMockTenant ? mockScopedAccounts : apiAccounts;
  const transactions = isMockTenant ? mockScopedTransactions : apiTransactions;

  const branchNameById = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches],
  );

  const monthRange = useMemo(() => getMonthDateRange(), []);

  const receivablesSummary = useMemo(() => {
    if (isMockTenant) {
      return computeReceivablesSummary(
        mockReceivables,
        mockArPayments,
        branchIds,
        monthRange,
      );
    }
    return (
      apiReceivablesSummary ?? {
        totalOutstanding: 0,
        newThisMonth: 0,
        collectedThisMonth: 0,
        overdue: 0,
        activeInvoiceCount: 0,
      }
    );
  }, [
    isMockTenant,
    mockReceivables,
    mockArPayments,
    branchIds,
    monthRange,
    apiReceivablesSummary,
  ]);

  const profitLoss = useMemo(
    () => {
      if (!isMockTenant && financeQuery.data?.profitLoss) {
        return financeQuery.data.profitLoss;
      }
      return computeProfitLoss(
        transactions,
        monthRange,
        isMockTenant ? mockScopedSales : undefined,
      );
    },
    [transactions, monthRange, isMockTenant, mockScopedSales, financeQuery.data?.profitLoss],
  );

  const cashFlow = useMemo(() => computeCashFlowSeries(transactions, 14), [transactions]);

  const totalBalance = useMemo(
    () => accounts.reduce((s, a) => s + a.balance, 0),
    [accounts],
  );

  const totalCash = useMemo(
    () => accounts.filter((a) => a.type === "cash").reduce((s, a) => s + a.balance, 0),
    [accounts],
  );

  const totalBank = useMemo(
    () => accounts.filter((a) => a.type === "bank").reduce((s, a) => s + a.balance, 0),
    [accounts],
  );

  const branchSummaries = useMemo<FinanceBranchSummary[]>(() => {
    if (!isConsolidated || !isOwner) return [];

    if (!isMockTenant) {
      return branches
        .filter((b) => branchIds.includes(b.id))
        .map((branch) => {
          const branchAccounts = accounts.filter((a) => a.branch_id === branch.id);
          const pl = financeQuery.data?.branchProfitLoss.get(branch.id);
          return {
            branchId: branch.id,
            branchName: branch.name,
            totalBalance: branchAccounts.reduce((s, a) => s + a.balance, 0),
            sales: pl?.sales ?? 0,
            netProfit: pl?.netProfit ?? 0,
            receivablesOutstanding: 0,
          };
        });
    }

    return branches.map((branch) => {
      const branchAccounts = mockAccounts.filter((a) => a.branch_id === branch.id);
      const branchTxs = mockTransactions.filter((t) => t.branch_id === branch.id);
      const branchSales = mockSales.filter(
        (s) =>
          s.tenantId === tenantId &&
          s.branchId === branch.id &&
          s.status === "completed",
      );
      const pl = computeProfitLoss(branchTxs, monthRange, branchSales);
      const ar = computeReceivablesSummary(
        mockReceivables,
        mockArPayments,
        [branch.id],
        monthRange,
      );

      return {
        branchId: branch.id,
        branchName: branch.name,
        totalBalance: branchAccounts.reduce((s, a) => s + a.balance, 0),
        sales: pl.sales,
        netProfit: pl.netProfit,
        receivablesOutstanding: ar.totalOutstanding,
      };
    });
  }, [
    isMockTenant,
    isConsolidated,
    isOwner,
    branches,
    mockAccounts,
    mockTransactions,
    mockReceivables,
    mockArPayments,
    mockSales,
    monthRange,
    tenantId,
    accounts,
    branchIds,
    financeQuery.data?.branchProfitLoss,
  ]);

  return {
    user: currentUser?.profile ?? null,
    branch: activeBranch,
    isConsolidated: isConsolidated && isOwner,
    scopeLabel,
    branchNameById,
    loading,
    accounts,
    transactions,
    profitLoss,
    cashFlow,
    totalBalance,
    totalCash,
    totalBank,
    receivablesSummary,
    branchSummaries,
    monthRange,
    tenantSlug,
    loadData: financeQuery.refetch,
  };
}

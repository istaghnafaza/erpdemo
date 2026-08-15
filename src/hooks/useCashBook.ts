// =============================================================================
// useCashBook — buku kas + catat pengeluaran (Fase 11).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { isMockTenantId } from "@/lib/mock-session";
import { useBranchStore } from "@/stores/branch.store";
import { useFinanceStore } from "@/stores/finance.store";
import { useReceivablesStore } from "@/stores/receivables.store";
import { usePayablesStore } from "@/stores/payables.store";
import { useSalesTransactionsStore } from "@/stores/sales-transactions.store";
import { fetchCashBookOverview } from "@/lib/finance-overview-client";
import { recordCashTransaction, transferBetweenAccounts } from "@/lib/api/finance";
import { queryKeys } from "@/lib/query-keys";
import { EXPENSE_CATEGORIES } from "@/lib/mock-finance";
import { filterFinanceByBranches, getFinanceScopeLabel } from "@/lib/finance-scope";
import { resolveScopedBranchIds } from "@/lib/branch-scope";
import type { MockCashTxWithAccount } from "@/lib/mock-finance";
import type { CashAccount, DbCashTxType } from "@/types/database";

export function useCashBook() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const branches = useBranchStore((s) => s.branches);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const mockAccounts = useFinanceStore((s) => s.mockCashAccounts);
  const mockTransactions = useFinanceStore((s) => s.mockCashTransactions);
  const recordMockExpense = useFinanceStore((s) => s.recordMockExpense);
  const initializeMockFinance = useFinanceStore((s) => s.initializeMockFinance);
  const syncHistoricalArApPayments = useFinanceStore((s) => s.syncHistoricalArApPayments);
  const mockSales = useSalesTransactionsStore((s) => s.transactions);
  const mockReceivables = useReceivablesStore((s) => s.mockReceivables);
  const mockArPayments = useReceivablesStore((s) => s.mockPayments);
  const mockPayables = usePayablesStore((s) => s.mockPayables);
  const mockApPayments = usePayablesStore((s) => s.mockPayments);

  const user = currentUser?.profile ?? null;
  const tenantId = currentUser?.tenantId ?? "";
  const isMockTenant = isMockTenantId(tenantId);
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
  const canRecordExpense = !(isConsolidated && isOwner) && !!activeBranch;

  const [actionLoading, setActionLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<DbCashTxType | "all">("all");

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

  const cashBookQuery = useQuery({
    queryKey: queryKeys.cashBookOverview(tenantId, branchIds, dateFrom, dateTo),
    queryFn: () => fetchCashBookOverview(tenantId, branchIds, dateFrom, dateTo),
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

  const loading = isMockTenant ? false : cashBookQuery.isPending;
  const accounts = isMockTenant ? mockScopedAccounts : (cashBookQuery.data?.accounts ?? []);
  const transactions = isMockTenant
    ? mockScopedTransactions
    : (cashBookQuery.data?.transactions ?? []);

  const branchNameById = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches],
  );

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const d = tx.created_at.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (accountFilter !== "all" && tx.cash_account_id !== accountFilter) return false;
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      return true;
    });
  }, [transactions, dateFrom, dateTo, accountFilter, typeFilter]);

  const refreshData = useCallback(async () => {
    if (isMockTenant) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.cashBookOverview(tenantId, branchIds, dateFrom, dateTo),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.financeOverview(tenantId, branchIds),
    });
    await queryClient.invalidateQueries({ queryKey: ["cashflow-vs-accrual"] });
    await queryClient.invalidateQueries({ queryKey: ["cash-forecast"] });
    await queryClient.invalidateQueries({ queryKey: ["cashflow-kpis"] });
  }, [isMockTenant, queryClient, tenantId, branchIds, dateFrom, dateTo]);

  const recordExpense = useCallback(
    async (data: {
      cash_account_id: string;
      category: string;
      amount: number;
      description: string | null;
      reference: string | null;
    }) => {
      if (!user || !activeBranch?.id) {
        return { success: false, error: "Pilih cabang terlebih dahulu" };
      }
      if (isConsolidated && isOwner) {
        return {
          success: false,
          error: "Catat pengeluaran per cabang — pilih cabang spesifik, bukan mode konsolidasi",
        };
      }

      setActionLoading(true);
      if (isMockTenant) {
        const result = recordMockExpense({
          ...data,
          tenant_id: tenantId,
          branch_id: activeBranch.id,
          user_id: user.id,
        });
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        setFormOpen(false);
        return { success: true };
      }

      const txResult = await recordCashTransaction(
        tenantId,
        activeBranch.id,
        data.cash_account_id,
        {
          type: "expense",
          category: data.category,
          amount: data.amount,
          reference: data.reference,
          description: data.description,
          user_id: user.id,
        },
      );
      setActionLoading(false);
      if (txResult.error) return { success: false, error: txResult.error };
      setFormOpen(false);
      await refreshData();
      return { success: true };
    },
    [
      user,
      activeBranch,
      isConsolidated,
      isOwner,
      isMockTenant,
      tenantId,
      recordMockExpense,
      refreshData,
    ],
  );

  const transferCash = useCallback(
    async (data: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      description: string | null;
    }) => {
      if (!user || !activeBranch?.id) {
        return { success: false, error: "Pilih cabang terlebih dahulu" };
      }
      if (isMockTenant) {
        return { success: false, error: "Transfer internal tersedia di data Neon" };
      }
      setActionLoading(true);
      const result = await transferBetweenAccounts(
        tenantId,
        data.fromAccountId,
        data.toAccountId,
        data.amount,
        data.description,
      );
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      await refreshData();
      return { success: true };
    },
    [user, activeBranch, isMockTenant, tenantId, refreshData],
  );

  return {
    user,
    branch: activeBranch,
    isConsolidated: isConsolidated && isOwner,
    scopeLabel,
    branchNameById,
    canRecordExpense,
    loading,
    transactions: filteredTransactions,
    accounts,
    expenseCategories: EXPENSE_CATEGORIES,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    accountFilter,
    setAccountFilter,
    typeFilter,
    setTypeFilter,
    formOpen,
    setFormOpen,
    transferOpen,
    setTransferOpen,
    actionLoading,
    recordExpense,
    transferCash,
    loadData: refreshData,
  };
}

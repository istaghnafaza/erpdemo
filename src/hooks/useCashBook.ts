// =============================================================================
// useCashBook — buku kas + catat pengeluaran (Fase 11).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore, MOCK_TENANT_ID } from "@/stores/auth.store";
import { isNeonBackend } from "@/lib/api/backend";
import { useBranchStore } from "@/stores/branch.store";
import { useFinanceStore } from "@/stores/finance.store";
import { useReceivablesStore } from "@/stores/receivables.store";
import { usePayablesStore } from "@/stores/payables.store";
import { useSalesTransactionsStore } from "@/stores/sales-transactions.store";
import { getCashAccounts, getCashTransactions, recordCashTransaction } from "@/lib/api/finance";
import { EXPENSE_CATEGORIES } from "@/lib/mock-finance";
import { filterFinanceByBranches, getFinanceScopeLabel } from "@/lib/finance-scope";
import { resolveScopedBranchIds } from "@/lib/branch-scope";
import type { MockCashTxWithAccount } from "@/lib/mock-finance";
import type { CashAccount, DbCashTxType } from "@/types/database";

export function useCashBook() {
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
  const isMockTenant = tenantId === MOCK_TENANT_ID && !isNeonBackend();
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

  const [apiAccounts, setApiAccounts] = useState<CashAccount[]>([]);
  const [apiTransactions, setApiTransactions] = useState<MockCashTxWithAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<DbCashTxType | "all">("all");

  const mockScopedAccounts = useMemo(
    () => filterFinanceByBranches(mockAccounts, branchIds),
    [mockAccounts, branchIds],
  );

  const mockScopedTransactions = useMemo(
    () => filterFinanceByBranches(mockTransactions, branchIds),
    [mockTransactions, branchIds],
  );

  const loadApiData = useCallback(async () => {
    setLoading(true);

    if (branchIds.length === 0) {
      setApiAccounts([]);
      setApiTransactions([]);
      setLoading(false);
      return;
    }

    const accountResults = await Promise.all(
      branchIds.map((id) => getCashAccounts(tenantId, id, { activeOnly: true })),
    );
    const txResults = await Promise.all(
      branchIds.map((id) =>
        getCashTransactions(tenantId, id, {
          dateRange: dateFrom || dateTo ? { from: dateFrom, to: dateTo } : undefined,
          limit: 500,
        }),
      ),
    );

    setApiAccounts(accountResults.flatMap((r) => r.data ?? []));
    setApiTransactions(
      txResults.flatMap((r) => (r.data ?? []) as MockCashTxWithAccount[]),
    );
    setLoading(false);
  }, [branchIds, tenantId, dateFrom, dateTo]);

  useEffect(() => {
    if (isMockTenant) {
      initializeMockFinance(mockSales);
      syncHistoricalArApPayments({
        receivables: mockReceivables,
        arPayments: mockArPayments,
        payables: mockPayables,
        apPayments: mockApPayments,
      });
      setLoading(false);
      return;
    }
    void loadApiData();
  }, [
    isMockTenant,
    loadApiData,
    initializeMockFinance,
    syncHistoricalArApPayments,
    mockSales,
    mockReceivables,
    mockArPayments,
    mockPayables,
    mockApPayments,
  ]);

  const accounts = isMockTenant ? mockScopedAccounts : apiAccounts;
  const transactions = isMockTenant ? mockScopedTransactions : apiTransactions;

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
      await loadApiData();
      return { success: true };
    },
    [user, activeBranch, isConsolidated, isOwner, isMockTenant, tenantId, recordMockExpense, loadApiData],
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
    actionLoading,
    recordExpense,
    loadData: loadApiData,
  };
}

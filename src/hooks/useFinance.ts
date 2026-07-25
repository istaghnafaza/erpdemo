// =============================================================================
// useFinance — dashboard keuangan (Fase 11).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore, MOCK_TENANT_ID } from "@/stores/auth.store";
import { isNeonBackend } from "@/lib/api/backend";
import { isMockTenantId } from "@/lib/mock-session";
import { useBranchStore } from "@/stores/branch.store";
import { useFinanceStore } from "@/stores/finance.store";
import { useReceivablesStore } from "@/stores/receivables.store";
import { usePayablesStore } from "@/stores/payables.store";
import { useSalesTransactionsStore } from "@/stores/sales-transactions.store";
import { getCashAccounts, getCashTransactions } from "@/lib/api/finance";
import { getArSummary } from "@/lib/api/receivables";
import {
  computeCashFlowSeries,
  computeProfitLoss,
  getMonthDateRange,
} from "@/lib/finance-calculations";
import {
  computeReceivablesSummary,
  type ReceivablesSummary,
} from "@/lib/receivables-calculations";
import { filterFinanceByBranches, getFinanceScopeLabel } from "@/lib/finance-scope";
import { resolveScopedBranchIds } from "@/lib/branch-scope";
import type { MockCashTxWithAccount } from "@/lib/mock-finance";
import type { CashAccount } from "@/types/database";

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

  const [apiAccounts, setApiAccounts] = useState<CashAccount[]>([]);
  const [apiTransactions, setApiTransactions] = useState<MockCashTxWithAccount[]>([]);
  const [apiReceivablesSummary, setApiReceivablesSummary] = useState<ReceivablesSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

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

  const loadApiData = useCallback(async () => {
    setLoading(true);

    if (branchIds.length === 0) {
      setApiAccounts([]);
      setApiTransactions([]);
      setApiReceivablesSummary(null);
      setLoading(false);
      return;
    }

    const accountResults = await Promise.all(
      branchIds.map((id) => getCashAccounts(tenantId, id, { activeOnly: true })),
    );
    const txResults = await Promise.all(
      branchIds.map((id) => getCashTransactions(tenantId, id, { limit: 500 })),
    );
    const arResults = await Promise.all(branchIds.map((id) => getArSummary(tenantId, id)));

    const arAgg = arResults.reduce(
      (acc, r) => {
        const d = r.data;
        if (!d) return acc;
        return {
          totalOutstanding: acc.totalOutstanding + d.total,
          newThisMonth: acc.newThisMonth,
          collectedThisMonth: acc.collectedThisMonth,
          overdue: acc.overdue + d.overdue,
          activeInvoiceCount: acc.activeInvoiceCount + d.unpaid + d.partial,
        };
      },
      {
        totalOutstanding: 0,
        newThisMonth: 0,
        collectedThisMonth: 0,
        overdue: 0,
        activeInvoiceCount: 0,
      } satisfies ReceivablesSummary,
    );

    setApiAccounts(accountResults.flatMap((r) => r.data ?? []));
    setApiTransactions(
      txResults.flatMap((r) => (r.data ?? []) as MockCashTxWithAccount[]),
    );
    setApiReceivablesSummary(arAgg);
    setLoading(false);
  }, [branchIds, tenantId]);

  useEffect(() => {
    if (isMockTenant) {
      setLoading(false);
      return;
    }
    void loadApiData();
  }, [isMockTenant, loadApiData]);

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
    () =>
      computeProfitLoss(
        transactions,
        monthRange,
        isMockTenant ? mockScopedSales : undefined,
      ),
    [transactions, monthRange, isMockTenant, mockScopedSales],
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
    if (!isMockTenant || !isConsolidated || !isOwner) return [];

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
    loadData: loadApiData,
  };
}

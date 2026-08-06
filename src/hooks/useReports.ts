// =============================================================================
// useReports — scoped report data (Fase 13).
// Demo/mock: reports-calculations + local stores.
// Neon: API agregasi dari database tenant.
// =============================================================================

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { isNeonBackend } from "@/lib/api/backend";
import { isMockTenantId } from "@/lib/mock-session";
import { getReportsBundle } from "@/lib/api/reports";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore, MOCK_TENANT_ID } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useFinanceStore } from "@/stores/finance.store";
import { useReceivablesStore } from "@/stores/receivables.store";
import { usePayablesStore } from "@/stores/payables.store";
import { useSalesTransactionsStore } from "@/stores/sales-transactions.store";
import { filterFinanceByBranches, getFinanceScopeLabel } from "@/lib/finance-scope";
import { resolveScopedBranchIds } from "@/lib/branch-scope";
import {
  computeCashierAudit,
  computeOpnameVarianceReport,
  computePaymentMethodBreakdown,
  computeProfitLossReport,
  computeSalesReport,
  computeTopProductsReport,
  getMonthDateRange,
  type ReportPeriod,
} from "@/lib/reports-calculations";

export function useReports(initialPeriod: ReportPeriod = "30") {
  const user = useAuthStore((s) => s.currentUser?.profile);
  const tenantSlug = useAuthStore((s) => s.currentTenant?.slug) ?? "";
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const branches = useBranchStore((s) => s.branches);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const mockTransactions = useFinanceStore((s) => s.mockCashTransactions);
  const initializeMockFinance = useFinanceStore((s) => s.initializeMockFinance);
  const syncHistoricalArApPayments = useFinanceStore((s) => s.syncHistoricalArApPayments);
  const mockSales = useSalesTransactionsStore((s) => s.transactions);
  const mockReceivables = useReceivablesStore((s) => s.mockReceivables);
  const mockArPayments = useReceivablesStore((s) => s.mockPayments);
  const mockPayables = usePayablesStore((s) => s.mockPayables);
  const mockApPayments = usePayablesStore((s) => s.mockPayments);

  const isMockTenant = isMockTenantId(tenantId);
  const useNeonData = isNeonBackend() && !isMockTenant;

  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);

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
  const consolidated = isConsolidated && isOwner;
  const monthRange = useMemo(() => getMonthDateRange(), []);

  const reportsQuery = useQuery({
    queryKey: queryKeys.reportsBundle(tenantId, branchIds, period, monthRange),
    queryFn: async () => {
      const result = await getReportsBundle(tenantId, branchIds, Number(period), monthRange);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: useNeonData && Boolean(tenantId) && branchIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const neonReports = reportsQuery.data ?? null;
  const neonLoading = reportsQuery.isPending;

  const scopedTransactions = useMemo(
    () => (isMockTenant ? filterFinanceByBranches(mockTransactions, branchIds) : []),
    [isMockTenant, mockTransactions, branchIds],
  );

  const scopedSales = useMemo(
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

  const mockSalesReport = useMemo(
    () => computeSalesReport(period, branchIds, consolidated),
    [period, branchIds, consolidated],
  );
  const mockTopProducts = useMemo(
    () => computeTopProductsReport(branchIds, consolidated),
    [branchIds, consolidated],
  );
  const mockPaymentMethods = useMemo(() => computePaymentMethodBreakdown(), []);
  const mockProfitLoss = useMemo(
    () => computeProfitLossReport(scopedTransactions, monthRange.from, monthRange.to, scopedSales),
    [scopedTransactions, monthRange, scopedSales],
  );
  const mockCashierAudit = useMemo(
    () => computeCashierAudit(branchIds, consolidated),
    [branchIds, consolidated],
  );
  const mockOpnameVariance = useMemo(
    () => computeOpnameVarianceReport(branchIds, consolidated),
    [branchIds, consolidated],
  );

  const emptyNeonSales = useMemo(() => {
    const chart = Array.from({ length: Number(period) }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (Number(period) - 1 - i));
      const date = d.toISOString().split("T")[0]!;
      return {
        date,
        label: new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        total: 0,
        transactions: 0,
      };
    });
    return {
      chart,
      summary: { totalSales: 0, totalTransactions: 0, avgTicket: 0 },
    };
  }, [period]);

  const emptyNeonProfitLoss = useMemo(
    () => ({
      sales: 0,
      salesMargin: 0,
      cogs: 0,
      grossProfit: 0,
      opex: 0,
      netProfit: 0,
      marginPct: 0,
      grossMarginPct: 0,
    }),
    [],
  );

  const salesReport = useNeonData
    ? (neonReports?.salesReport ?? emptyNeonSales)
    : mockSalesReport;
  const topProducts = useNeonData ? (neonReports?.topProducts ?? []) : mockTopProducts;
  const paymentMethods = useNeonData ? (neonReports?.paymentMethods ?? []) : mockPaymentMethods;
  const profitLoss = useNeonData
    ? (neonReports?.profitLoss ?? emptyNeonProfitLoss)
    : mockProfitLoss;
  const cashierAudit = useNeonData
    ? (neonReports?.cashierAudit ?? { cashiers: [], transactions: [] })
    : mockCashierAudit;
  const opnameVariance = useNeonData ? [] : mockOpnameVariance;

  const totalOpnameLoss = useMemo(
    () => opnameVariance.reduce((s, r) => s + r.estimatedLoss, 0),
    [opnameVariance],
  );

  return {
    user,
    tenantSlug,
    period,
    setPeriod,
    scopeLabel,
    isConsolidated: consolidated,
    branchIds,
    loading: useNeonData && neonLoading,
    salesReport,
    topProducts,
    paymentMethods,
    profitLoss,
    monthRange,
    cashierAudit,
    opnameVariance,
    totalOpnameLoss,
  };
}

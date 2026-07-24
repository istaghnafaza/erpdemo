// =============================================================================
// useSalesTransactionsPage — scoped sales history + summary
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useSalesTransactionsStore } from "@/stores/sales-transactions.store";
import { listSalesTransactions } from "@/lib/api/sales-transactions";
import { isNeonBackend } from "@/lib/api/backend";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import { getFinanceScopeLabel } from "@/lib/finance-scope";
import { resolveScopedBranchIds } from "@/lib/branch-scope";
import { computeTransactionsMarginSummary } from "@/lib/sales-margin";
import type { SalesTransactionRecord } from "@/types/sales-transactions";

function startOfDay(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function useSalesTransactionsPage() {
  const user = useAuthStore((s) => s.currentUser?.profile);
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const tenantSlug = useAuthStore((s) => s.currentTenant?.slug) ?? "";
  const branches = useBranchStore((s) => s.branches);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const mockTransactions = useSalesTransactionsStore((s) => s.transactions);
  const seedIfEmpty = useSalesTransactionsStore((s) => s.seedIfEmpty);

  const [neonRows, setNeonRows] = useState<SalesTransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isOwner = user?.role === "owner";
  const consolidated = isConsolidated && isOwner;

  const branchIds = useMemo(
    () =>
      resolveScopedBranchIds({
        branches,
        activeBranch,
        isConsolidated: consolidated,
        isOwner,
      }),
    [consolidated, isOwner, branches, activeBranch],
  );

  const useNeonApi =
    isNeonBackend() && tenantId !== MOCK_TENANT_ID;

  useEffect(() => {
    if (!useNeonApi || !tenantId || branchIds.length === 0) {
      if (!useNeonApi) seedIfEmpty();
      return;
    }

    let cancelled = false;
    setLoading(true);
    void listSalesTransactions(tenantId, branchIds).then((result) => {
      if (cancelled) return;
      setNeonRows(result.data ?? []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [useNeonApi, tenantId, branchIds, seedIfEmpty]);

  const transactions = useNeonApi ? neonRows : mockTransactions;
  const scopeLabel = getFinanceScopeLabel(consolidated, activeBranch);

  const scopedRows = useMemo(() => {
    if (!tenantId) return [];
    const allowed = new Set(branchIds);
    let list = transactions
      .filter((t) => t.tenantId === tenantId && allowed.has(t.branchId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (user?.role === "cashier") {
      list = list.filter((t) => t.cashierId === user.id);
    }
    return list;
  }, [transactions, tenantId, branchIds, user?.id, user?.role]);

  const rows = useMemo(() => {
    let result = scopedRows;
    if (dateFrom) {
      const from = startOfDay(dateFrom);
      result = result.filter((t) => new Date(t.createdAt).getTime() >= from);
    }
    if (dateTo) {
      const to = startOfDay(dateTo) + 86_400_000 - 1;
      result = result.filter((t) => new Date(t.createdAt).getTime() <= to);
    }
    return result;
  }, [scopedRows, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const completed = rows.filter((t) => t.status === "completed");
    const marginSummary = computeTransactionsMarginSummary(rows);
    return {
      totalRows: rows.length,
      completedCount: completed.length,
      voidCount: rows.filter((t) => t.status === "voided").length,
      totalRevenue: marginSummary.totalRevenue,
      totalMargin: marginSummary.totalMargin,
      marginPct: marginSummary.marginPct,
      offlineCount: rows.filter((t) => t.isOffline).length,
    };
  }, [rows]);

  const [selectedTx, setSelectedTx] = useState<SalesTransactionRecord | null>(null);

  const clearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
  };

  return {
    user,
    tenantSlug,
    rows,
    scopeLabel,
    isConsolidated: consolidated,
    summary,
    loading,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    clearDateFilter,
    selectedTx,
    setSelectedTx,
  };
}

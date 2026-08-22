// =============================================================================
// usePayablesPage — AP list scoped per cabang (Neon + mock)
// =============================================================================

import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useFinanceStore } from "@/stores/finance.store";
import { usePayablesStore } from "@/stores/payables.store";
import { SUPPLIERS } from "@/lib/mock-data";
import type { Payable } from "@/lib/mock-data";
import { isMockTenantId } from "@/lib/mock-session";
import { isNeonBackend } from "@/lib/api/backend";
import { getPayables, recordApPayment } from "@/lib/api/payables";
import { getCashAccounts } from "@/lib/api/finance";
import { todayKeyInAppTz } from "@/lib/app-timezone";
import type { AccountPayable } from "@/types/database";
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
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const isMockTenant = isMockTenantId(tenantId);
  const branches = useBranchStore((s) => s.branches);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const payables = usePayablesStore((s) => s.mockPayables);
  const payments = usePayablesStore((s) => s.mockPayments);
  const recordMockPaymentRaw = usePayablesStore((s) => s.recordMockPayment);
  const cashAccounts = useFinanceStore((s) => s.mockCashAccounts);
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

  const neonApQuery = useQuery({
    queryKey: ["payables", tenantId, branchIds.join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        branchIds.map((id) => getPayables(tenantId, id)),
      );
      const rows: AccountPayable[] = [];
      for (const r of results) {
        if (r.error) throw new Error(r.error);
        rows.push(...(r.data ?? []));
      }
      return rows;
    },
    enabled: isNeonBackend() && !isMockTenant && Boolean(tenantId) && branchIds.length > 0,
  });

  const neonAccountsQuery = useQuery({
    queryKey: ["cash-accounts-ap", tenantId, branchIds.join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        branchIds.map((id) => getCashAccounts(tenantId, id, { activeOnly: true })),
      );
      return results.flatMap((r) => r.data ?? []);
    },
    enabled: isNeonBackend() && !isMockTenant && Boolean(tenantId) && branchIds.length > 0,
  });

  const neonPayables: Payable[] = useMemo(
    () =>
      (neonApQuery.data ?? []).map((r) => ({
        id: r.id,
        supplierId: r.supplier_id,
        branchId: r.branch_id,
        invoice: r.invoice_number,
        amount: r.total_amount,
        paid: r.paid_amount,
        dueDate: r.due_date,
        issuedDate: r.created_at,
      })),
    [neonApQuery.data],
  );

  const scopedPayables = useMemo(() => {
    const rows = isMockTenant ? filterByBranchIds(payables, branchIds) : neonPayables;
    // Hutang = sisa belum lunas. COD/tunai tidak masuk daftar.
    return rows.filter((p) => remainingAmount(p.amount, p.paid) > 0);
  }, [isMockTenant, payables, branchIds, neonPayables]);

  const scopedPayments = useMemo(
    () => filterByBranchIds(payments, branchIds),
    [payments, branchIds],
  );

  const scopedCashAccounts = useMemo(
    () =>
      isMockTenant
        ? filterFinanceByBranches(cashAccounts, branchIds)
        : (neonAccountsQuery.data ?? []),
    [isMockTenant, cashAccounts, branchIds, neonAccountsQuery.data],
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

  const supplierNameById = useMemo(() => {
    const map = Object.fromEntries(SUPPLIERS.map((s) => [s.id, s.name]));
    for (const row of neonApQuery.data ?? []) {
      map[row.supplier_id] = row.supplier_name;
    }
    return map;
  }, [neonApQuery.data]);

  const recordMockPayment = useCallback(
    (draft: {
      payable_id: string;
      amount: number;
      cash_account_id: string;
      user_id: string;
    }) => {
      if (!isMockTenant) {
        void (async () => {
          const result = await recordApPayment(tenantId, draft.payable_id, {
            amount: draft.amount,
            payment_date: todayKeyInAppTz(),
            notes: null,
            user_id: draft.user_id,
            cash_account_id: draft.cash_account_id,
          });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Pembayaran hutang dicatat");
          await queryClient.invalidateQueries({ queryKey: ["payables", tenantId] });
          await queryClient.invalidateQueries({ queryKey: ["finance-overview", tenantId] });
          await queryClient.invalidateQueries({ queryKey: ["cashflow-vs-accrual"] });
          await queryClient.invalidateQueries({ queryKey: ["cashflow-kpis"] });
        })();
        return { ok: true as const };
      }
      return recordMockPaymentRaw(draft);
    },
    [isMockTenant, tenantId, queryClient, recordMockPaymentRaw],
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
    loading: !isMockTenant && neonApQuery.isPending,
  };
}

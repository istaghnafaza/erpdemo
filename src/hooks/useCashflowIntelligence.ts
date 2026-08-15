import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { isMockTenantId } from "@/lib/mock-session";
import { useBranchStore } from "@/stores/branch.store";
import { resolveScopedBranchIds } from "@/lib/branch-scope";
import { queryKeys } from "@/lib/query-keys";
import {
  getCashForecast,
  getCashVsAccrual,
  getCashflowDashboardKpis,
  getInventoryCashLock,
} from "@/lib/api/finance";
import { isNeonBackend } from "@/lib/api/backend";

export function useCashflowScope() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const branches = useBranchStore((s) => s.branches);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const tenantId = currentUser?.tenantId ?? "";
  const isOwner = currentUser?.profile.role === "owner";
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
  return { tenantId, branchIds, isMock: isMockTenantId(tenantId) };
}

export function useCashVsAccrual() {
  const { tenantId, branchIds, isMock } = useCashflowScope();
  return useQuery({
    queryKey: queryKeys.cashflowVsAccrual(tenantId, branchIds),
    queryFn: async () => {
      const result = await getCashVsAccrual(tenantId, [...branchIds]);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: isNeonBackend() && !isMock && Boolean(tenantId) && branchIds.length > 0,
    staleTime: 60_000,
  });
}

export function useCashForecast() {
  const { tenantId, branchIds, isMock } = useCashflowScope();
  return useQuery({
    queryKey: queryKeys.cashForecast(tenantId, branchIds),
    queryFn: async () => {
      const result = await getCashForecast(tenantId, [...branchIds]);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: isNeonBackend() && !isMock && Boolean(tenantId) && branchIds.length > 0,
    staleTime: 60_000,
  });
}

export function useInventoryCashLock(categoryId?: string) {
  const { tenantId, branchIds, isMock } = useCashflowScope();
  return useQuery({
    queryKey: queryKeys.cashLock(tenantId, branchIds, categoryId ?? ""),
    queryFn: async () => {
      const result = await getInventoryCashLock(tenantId, [...branchIds], categoryId);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: isNeonBackend() && !isMock && Boolean(tenantId) && branchIds.length > 0,
    staleTime: 60_000,
  });
}

export function useCashflowDashboardKpis() {
  const { tenantId, branchIds, isMock } = useCashflowScope();
  return useQuery({
    queryKey: queryKeys.cashflowKpis(tenantId, branchIds),
    queryFn: async () => {
      const result = await getCashflowDashboardKpis(tenantId, [...branchIds]);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: isNeonBackend() && !isMock && Boolean(tenantId) && branchIds.length > 0,
    staleTime: 60_000,
  });
}

// =============================================================================
// useDeliveriesPage — scoped delivery list + summary (Neon + mock local).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useDeliveriesStore } from "@/stores/deliveries.store";
import { listDeliveries, updateDelivery as updateDeliveryApi } from "@/lib/api/deliveries";
import { isNeonBackend } from "@/lib/api/backend";
import { isMockTenantId } from "@/lib/mock-session";
import { canEdit } from "@/lib/rbac";
import { getFinanceScopeLabel } from "@/lib/finance-scope";
import { resolveScopedBranchIds } from "@/lib/branch-scope";
import type { DeliveryRecord, DeliveryStatus, UpdateDeliveryDraft } from "@/types/deliveries";

function startOfDay(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function useDeliveriesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.currentUser?.profile);
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const branches = useBranchStore((s) => s.branches);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const mockDeliveries = useDeliveriesStore((s) => s.deliveries);
  const seedIfEmpty = useDeliveriesStore((s) => s.seedIfEmpty);
  const updateMockDelivery = useDeliveriesStore((s) => s.updateDelivery);

  const isMockTenant = isMockTenantId(tenantId);
  const useNeonData = isNeonBackend() && !isMockTenant;

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "all">("all");
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRecord | null>(null);

  useEffect(() => {
    if (!useNeonData) seedIfEmpty();
  }, [useNeonData, seedIfEmpty]);

  const isOwner = user?.role === "owner";
  const consolidated = isConsolidated && isOwner;
  const canEditDelivery = canEdit(user?.role, "deliveries");

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

  const scopeLabel = getFinanceScopeLabel(consolidated, activeBranch);

  const deliveriesQuery = useQuery({
    queryKey: ["deliveries", tenantId, branchIds.join(",")],
    enabled: useNeonData && Boolean(tenantId) && branchIds.length > 0,
    queryFn: async () => {
      const result = await listDeliveries(tenantId, branchIds);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
  });

  const sourceDeliveries = useNeonData ? (deliveriesQuery.data ?? []) : mockDeliveries;

  const scopedRows = useMemo(() => {
    if (!tenantId) return [];
    const allowed = new Set(branchIds);
    return sourceDeliveries
      .filter((d) => d.tenantId === tenantId && allowed.has(d.branchId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sourceDeliveries, tenantId, branchIds]);

  const rows = useMemo(() => {
    let result = scopedRows;
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter);
    }
    if (dateFrom) {
      const from = startOfDay(dateFrom);
      result = result.filter((d) => new Date(d.createdAt).getTime() >= from);
    }
    if (dateTo) {
      const to = startOfDay(dateTo) + 86_400_000 - 1;
      result = result.filter((d) => new Date(d.createdAt).getTime() <= to);
    }
    return result;
  }, [scopedRows, statusFilter, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const open = scopedRows.filter(
      (d) => !["delivered", "partial_delivered", "cancelled"].includes(d.status),
    );
    return {
      totalRows: scopedRows.length,
      pendingCount: scopedRows.filter((d) => d.status === "pending").length,
      inTransitCount: scopedRows.filter((d) => d.status === "in_transit").length,
      openCount: open.length,
      deliveredCount: scopedRows.filter(
        (d) => d.status === "delivered" || d.status === "partial_delivered",
      ).length,
    };
  }, [scopedRows]);

  const clearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
  };

  const saveDelivery = useCallback(
    async (id: string, patch: UpdateDeliveryDraft) => {
      if (useNeonData) {
        const result = await updateDeliveryApi(tenantId, id, patch);
        if (result.error) return { ok: false as const, error: result.error };
        await queryClient.invalidateQueries({ queryKey: ["deliveries", tenantId] });
        if (result.data) {
          setSelectedDelivery((prev) => (prev?.id === id ? result.data! : prev));
        }
        return { ok: true as const };
      }

      const result = updateMockDelivery(id, patch);
      if (result.ok) {
        setSelectedDelivery((prev) => {
          if (!prev || prev.id !== id) return prev;
          const updated = useDeliveriesStore.getState().deliveries.find((d) => d.id === id);
          return updated ?? prev;
        });
      }
      return result;
    },
    [useNeonData, tenantId, queryClient, updateMockDelivery],
  );

  return {
    user,
    rows,
    scopeLabel,
    isConsolidated: consolidated,
    summary,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    clearDateFilter,
    statusFilter,
    setStatusFilter,
    selectedDelivery,
    setSelectedDelivery,
    canEditDelivery,
    loading: useNeonData && deliveriesQuery.isLoading,
    saveDelivery,
  };
}

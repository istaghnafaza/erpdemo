// =============================================================================
// useDeliveriesPage — scoped delivery list + summary (demo/local).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useDeliveriesStore } from "@/stores/deliveries.store";
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
  const user = useAuthStore((s) => s.currentUser?.profile);
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const branches = useBranchStore((s) => s.branches);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const deliveries = useDeliveriesStore((s) => s.deliveries);
  const seedIfEmpty = useDeliveriesStore((s) => s.seedIfEmpty);
  const updateDelivery = useDeliveriesStore((s) => s.updateDelivery);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "all">("all");
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRecord | null>(null);

  useEffect(() => {
    seedIfEmpty();
  }, [seedIfEmpty]);

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

  const scopedRows = useMemo(() => {
    if (!tenantId) return [];
    const allowed = new Set(branchIds);
    return deliveries
      .filter((d) => d.tenantId === tenantId && allowed.has(d.branchId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [deliveries, tenantId, branchIds]);

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
    (id: string, patch: UpdateDeliveryDraft) => {
      const result = updateDelivery(id, patch);
      if (result.ok) {
        setSelectedDelivery((prev) => {
          if (!prev || prev.id !== id) return prev;
          const updated = useDeliveriesStore.getState().deliveries.find((d) => d.id === id);
          return updated ?? prev;
        });
      }
      return result;
    },
    [updateDelivery],
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
    saveDelivery,
  };
}

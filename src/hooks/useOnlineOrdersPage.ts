// =============================================================================
// useOnlineOrdersPage — kelola order online dari portal (staff SES).
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useCustomerPortalStore } from "@/stores/customer-portal.store";
import { onlineOrderStatusLabel, PORTAL_PAYMENT_LABELS } from "@/lib/portal-utils";
import type { OnlineOrderStatus } from "@/types/customer-portal";

export function useOnlineOrdersPage() {
  const user = useAuthStore((s) => s.currentUser?.profile);
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const branchId = useBranchStore((s) => s.activeBranch?.id) ?? null;

  const seedIfEmpty = useCustomerPortalStore((s) => s.seedIfEmpty);
  const orders = useCustomerPortalStore((s) => s.orders);
  const config = useCustomerPortalStore((s) => s.getConfig(tenantId));
  const listOrders = useCustomerPortalStore((s) => s.listOrdersForTenant);
  const approveOrder = useCustomerPortalStore((s) => s.approveOrder);
  const rejectOrder = useCustomerPortalStore((s) => s.rejectOrder);
  const confirmPayment = useCustomerPortalStore((s) => s.confirmPayment);
  const updateOrderStatus = useCustomerPortalStore((s) => s.updateOrderStatus);

  const [statusFilter, setStatusFilter] = useState<OnlineOrderStatus | "all">("all");

  useEffect(() => {
    seedIfEmpty();
  }, [seedIfEmpty]);

  const rows = useMemo(() => {
    const list = listOrders(tenantId, branchId);
    if (statusFilter === "all") return list;
    return list.filter((o) => o.status === statusFilter);
  }, [listOrders, tenantId, branchId, statusFilter, orders]);

  const pendingCount = useMemo(
    () =>
      listOrders(tenantId, branchId).filter((o) =>
        ["pending_approval", "payment_uploaded"].includes(o.status),
      ).length,
    [listOrders, tenantId, branchId, orders],
  );

  return {
    user,
    config,
    rows,
    statusFilter,
    setStatusFilter,
    pendingCount,
    approveOrder,
    rejectOrder,
    confirmPayment,
    updateOrderStatus,
    statusLabel: onlineOrderStatusLabel,
    paymentLabel: PORTAL_PAYMENT_LABELS,
  };
}

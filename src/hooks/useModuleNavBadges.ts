// =============================================================================
// useModuleNavBadges — angka pengingat di sidebar (SO, Pengiriman, Order Online).
// =============================================================================

import { useMemo } from "react";
import { isNeonBackend } from "@/lib/api/backend";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useDeliveriesStore } from "@/stores/deliveries.store";
import { useSalesOrdersStore } from "@/stores/sales-orders.store";
import { useCustomerPortalStore } from "@/stores/customer-portal.store";
import type { DeliveryStatus } from "@/types/deliveries";
import type { DbSoStatus } from "@/types/database";

const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = ["pending", "preparing", "in_transit"];
const ACTIVE_SO_STATUSES: DbSoStatus[] = ["confirmed", "partial_delivered"];

export function useModuleNavBadges() {
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId);
  const branchId = useBranchStore((s) => s.activeBranch?.id);
  const deliveries = useDeliveriesStore((s) => s.deliveries);
  const salesOrders = useSalesOrdersStore((s) => s.mockOrders);
  const onlineOrders = useCustomerPortalStore((s) => s.orders);
  const useMockBadges = !isNeonBackend();

  return useMemo(() => {
    if (!tenantId || !branchId || !useMockBadges) {
      return { deliveries: 0, sales_orders: 0, online_orders: 0 };
    }

    const deliveryCount = deliveries.filter(
      (d) =>
        d.tenantId === tenantId &&
        d.branchId === branchId &&
        ACTIVE_DELIVERY_STATUSES.includes(d.status),
    ).length;

    const salesOrderCount = salesOrders.filter(
      (o) =>
        o.tenant_id === tenantId &&
        o.branch_id === branchId &&
        ACTIVE_SO_STATUSES.includes(o.status),
    ).length;

    const onlineOrderCount = onlineOrders.filter(
      (o) =>
        o.tenantId === tenantId &&
        o.branchId === branchId &&
        ["pending_approval", "payment_uploaded"].includes(o.status),
    ).length;

    return {
      deliveries: deliveryCount,
      sales_orders: salesOrderCount,
      online_orders: onlineOrderCount,
    };
  }, [tenantId, branchId, useMockBadges, deliveries, salesOrders, onlineOrders]);
}

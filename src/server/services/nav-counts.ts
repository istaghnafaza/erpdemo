// =============================================================================
// Nav badge counts — lightweight sidebar counts (Sprint 3 P1-5, Fase C)
// =============================================================================

import { and, eq, inArray, sql } from "drizzle-orm";
import { getReadDb } from "@/server/db";
import { deliveries, onlineOrders, salesOrders } from "@/server/db/schema";
import type { ModuleNavCounts } from "@/types/app";

const ACTIVE_SO_STATUSES = ["confirmed", "partial_delivered"] as const;
const ACTIVE_DELIVERY_STATUSES = ["pending", "preparing", "in_transit"] as const;
const ACTIVE_ONLINE_ORDER_STATUSES = ["pending_approval", "payment_uploaded"] as const;

async function safeCount(
  query: Promise<{ count: number }[]>,
): Promise<number> {
  try {
    const [row] = await query;
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function getModuleNavCountsReport(
  tenantId: string,
  branchId: string,
): Promise<ModuleNavCounts> {
  const db = getReadDb();

  const [soCount, deliveryCount, onlineCount] = await Promise.all([
    safeCount(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(salesOrders)
        .where(
          and(
            eq(salesOrders.tenantId, tenantId),
            eq(salesOrders.branchId, branchId),
            inArray(salesOrders.status, [...ACTIVE_SO_STATUSES]),
          ),
        ),
    ),
    safeCount(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(deliveries)
        .where(
          and(
            eq(deliveries.tenantId, tenantId),
            eq(deliveries.branchId, branchId),
            inArray(deliveries.status, [...ACTIVE_DELIVERY_STATUSES]),
          ),
        ),
    ),
    safeCount(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(onlineOrders)
        .where(
          and(
            eq(onlineOrders.tenantId, tenantId),
            eq(onlineOrders.branchId, branchId),
            inArray(onlineOrders.status, [...ACTIVE_ONLINE_ORDER_STATUSES]),
          ),
        ),
    ),
  ]);

  return {
    deliveries: deliveryCount,
    sales_orders: soCount,
    online_orders: onlineCount,
  };
}

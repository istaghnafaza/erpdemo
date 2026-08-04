// =============================================================================
// SO fulfillment — helper untuk modul manager/warehouse
// =============================================================================

import type { MockSalesOrderItem, MockSalesOrderWithDetails } from "@/lib/mock-sales-orders";

export function soItemRemaining(item: MockSalesOrderItem): number {
  return Math.max(0, item.qty - item.delivered_qty);
}

export function soOrderRemainingQty(order: MockSalesOrderWithDetails): number {
  return order.items.reduce((sum, item) => sum + soItemRemaining(item), 0);
}

export function soOrderNeedsFulfillment(order: MockSalesOrderWithDetails): boolean {
  return (
    (order.status === "confirmed" || order.status === "partial_delivered") &&
    soOrderRemainingQty(order) > 0
  );
}

export function suggestStockFulfillQty(
  item: MockSalesOrderItem,
  availableStock: number,
): number {
  return Math.min(soItemRemaining(item), Math.max(0, availableStock));
}

export function prefillFulfillmentDraft(
  order: MockSalesOrderWithDetails,
  getProductStock: (productId: string) => number,
  getDefaultSupplierId?: (productId: string | null) => string | undefined,
): {
  stockQtys: Record<string, number>;
  indentQtys: Record<string, number>;
  supplierIds: Record<string, string>;
} {
  const stockQtys: Record<string, number> = {};
  const indentQtys: Record<string, number> = {};
  const supplierIds: Record<string, string> = {};

  for (const item of order.items) {
    if (item.status === "fulfilled") continue;
    const remaining = soItemRemaining(item);
    if (remaining <= 0) continue;
    stockQtys[item.id] = 0;
    indentQtys[item.id] = remaining;
    const supplierId = item.product_id ? getDefaultSupplierId?.(item.product_id) : undefined;
    if (supplierId) supplierIds[item.id] = supplierId;
  }

  return { stockQtys, indentQtys, supplierIds };
}

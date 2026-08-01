// =============================================================================
// Map Neon sales_orders rows → UI MockSalesOrderWithDetails shape
// =============================================================================

import type { MockSalesOrderWithDetails } from "@/lib/mock-sales-orders";
import type { SalesOrder, SalesOrderItem, SoFulfillment } from "@/types/database";

export type NeonSalesOrderRow = SalesOrder & {
  items: (SalesOrderItem & { fulfillments?: SoFulfillment[] })[];
  customer?: { name: string; phone: string | null };
};

export function mapNeonSalesOrderToDetails(order: NeonSalesOrderRow): MockSalesOrderWithDetails {
  const posMatch = order.notes?.match(/checkout POS\s+(\S+)/i);
  const posTxNumber = posMatch?.[1] ?? null;

  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      fulfillments: item.fulfillments ?? [],
    })),
    customer: order.customer,
    indent_pos: [],
    ar_invoice_number: null,
    source: posTxNumber ? "pos" : "manual",
    pos_transaction_id: null,
    pos_transaction_number: posTxNumber,
  };
}

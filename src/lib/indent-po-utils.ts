// =============================================================================
// Util PO indent — grup per supplier dalam satu SO (satu nomor PO).
// =============================================================================

import type {
  MockIndentPoRef,
  MockSalesOrderWithDetails,
} from "@/lib/mock-sales-orders";
import type { MockPoItem, MockPoWithItems } from "@/lib/mock-purchasing";

export function indentQtyForSoItem(
  order: MockSalesOrderWithDetails,
  soItemId: string,
): number {
  for (const po of order.indent_pos) {
    const line = po.lines.find((l) => l.so_item_id === soItemId);
    if (line) return line.qty;
  }
  return 0;
}

export function findIndentPoGroupBySupplier(
  order: MockSalesOrderWithDetails,
  supplierId: string,
): MockIndentPoRef | undefined {
  return order.indent_pos.find((p) => p.supplier_id === supplierId);
}

export function findIndentPoGroupForSoItem(
  order: MockSalesOrderWithDetails,
  soItemId: string,
): MockIndentPoRef | undefined {
  return order.indent_pos.find((p) => p.lines.some((l) => l.so_item_id === soItemId));
}

/** Tambah / update baris dalam grup PO indent di SO. */
export function upsertIndentPoLineInSo(
  order: MockSalesOrderWithDetails,
  group: {
    id: string;
    po_number: string;
    sales_order_id: string;
    supplier_id: string;
    supplier_name: string;
    status?: "draft" | "sent";
  },
  soItemId: string,
  qty: number,
): MockIndentPoRef {
  let po = order.indent_pos.find(
    (p) => p.id === group.id || p.supplier_id === group.supplier_id,
  );

  if (!po) {
    po = {
      id: group.id,
      po_number: group.po_number,
      sales_order_id: group.sales_order_id,
      supplier_id: group.supplier_id,
      supplier_name: group.supplier_name,
      status: group.status ?? "draft",
      lines: [],
    };
    order.indent_pos.push(po);
  }

  const existingLine = po.lines.find((l) => l.so_item_id === soItemId);
  if (existingLine) {
    existingLine.qty = qty;
  } else {
    po.lines.push({ so_item_id: soItemId, qty });
  }

  return po;
}

export function collectSoItemIdsFromIndentPos(
  mockPurchaseOrders: MockPoWithItems[],
  mockSalesOrders: MockSalesOrderWithDetails[],
): Set<string> {
  const ids = new Set<string>();

  for (const po of mockPurchaseOrders) {
    if (po.type !== "indent" || po.status === "cancelled") continue;
    for (const item of po.items as MockPoItem[]) {
      if (item.so_item_id) ids.add(item.so_item_id);
    }
    if (po.so_item_id) ids.add(po.so_item_id);
  }

  for (const so of mockSalesOrders) {
    for (const ip of so.indent_pos) {
      for (const line of ip.lines) {
        ids.add(line.so_item_id);
      }
    }
  }

  return ids;
}

export function findMockIndentPoBySupplier(
  mockPurchaseOrders: MockPoWithItems[],
  salesOrderId: string,
  supplierId: string,
): MockPoWithItems | undefined {
  return mockPurchaseOrders.find(
    (p) =>
      p.type === "indent" &&
      p.status !== "cancelled" &&
      p.sales_order_id === salesOrderId &&
      p.supplier_id === supplierId,
  );
}

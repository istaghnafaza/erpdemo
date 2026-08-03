// =============================================================================
// POS return offset — potong retur di checkout
// =============================================================================

import type { SalesReturnItemRecord } from "@/types/sales-returns";

export interface PosReturnOffsetLine {
  productName: string;
  sku: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface PosReturnOffset {
  returnId: string;
  returnNumber: string;
  amount: number;
  items: PosReturnOffsetLine[];
}

export function mapReturnItemsToOffsetLines(
  items: SalesReturnItemRecord[],
): PosReturnOffsetLine[] {
  return items
    .filter((i) => i.qtyQcPassed > 0 || i.qtyRequested > 0)
    .map((i) => ({
      productName: i.productName,
      sku: i.sku,
      qty: i.qtyQcPassed > 0 ? i.qtyQcPassed : i.qtyRequested,
      unitPrice: i.unitRefundPrice,
      subtotal:
        i.qtyQcPassed > 0
          ? Math.round(i.unitRefundPrice * i.qtyQcPassed)
          : i.refundSubtotal,
    }));
}

// =============================================================================
// Guard PO indent — satu baris SO (so_item_id) hanya boleh di satu PO indent aktif.
// Beberapa baris SO dengan supplier sama digabung dalam satu nomor PO.
// =============================================================================

import { collectSoItemIdsFromIndentPos } from "@/lib/indent-po-utils";
import type { MockPoWithItems } from "@/lib/mock-purchasing";
import type { MockSalesOrderWithDetails } from "@/lib/mock-sales-orders";

export function collectActiveIndentPoSoItemIds(
  mockPurchaseOrders: MockPoWithItems[],
  mockSalesOrders: MockSalesOrderWithDetails[],
): Set<string> {
  return collectSoItemIdsFromIndentPos(mockPurchaseOrders, mockSalesOrders);
}

export function hasActiveIndentPoForSoItem(
  soItemId: string,
  mockPurchaseOrders: MockPoWithItems[],
  mockSalesOrders: MockSalesOrderWithDetails[],
): boolean {
  return collectActiveIndentPoSoItemIds(mockPurchaseOrders, mockSalesOrders).has(soItemId);
}

export function indentPoDuplicateError(soNumber?: string | null): string {
  return soNumber
    ? `Baris SO ini sudah punya PO indent aktif (${soNumber}). Batalkan PO lama atau gunakan PO yang ada.`
    : "Baris SO ini sudah punya PO indent aktif. Batalkan PO lama atau gunakan PO yang ada.";
}

// =============================================================================
// Delivery helpers — labels & status rules.
// =============================================================================

import type { DeliveryStatus } from "@/types/deliveries";
import { orderFulfillmentLabel } from "@/lib/sales-transaction-utils";
import type { OrderFulfillmentType } from "@/types/sales-transactions";

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "Menunggu",
  preparing: "Disiapkan",
  in_transit: "Dalam Pengiriman",
  delivered: "Terkirim",
  partial_delivered: "Terkirim Sebagian",
  cancelled: "Dibatalkan",
};

export function deliveryStatusLabel(status: DeliveryStatus): string {
  return DELIVERY_STATUS_LABELS[status] ?? status;
}

export const DELIVERY_STATUS_KIND: Record<
  DeliveryStatus,
  "pending" | "warning" | "info" | "success" | "danger"
> = {
  pending: "pending",
  preparing: "warning",
  in_transit: "info",
  delivered: "success",
  partial_delivered: "warning",
  cancelled: "danger",
};

/** Status yang bisa dipilih user (urutan alur operasional). */
export const DELIVERY_STATUS_FLOW: DeliveryStatus[] = [
  "pending",
  "preparing",
  "in_transit",
  "delivered",
  "partial_delivered",
  "cancelled",
];

export function orderTypeLabel(type: OrderFulfillmentType): string {
  return orderFulfillmentLabel(type);
}

export function generateDeliveryNumber(branchCode: string, date: Date, sequence: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return `DO-${branchCode}-${y}${m}${d}-${seq}`;
}

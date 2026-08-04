// =============================================================================
// Sales transaction helpers — labels & payment mapping (demo/local).
// =============================================================================

import type { PaymentMethod } from "@/types/app";
import type { OrderFulfillmentType } from "@/types/sales-transactions";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Tunai",
  card: "Kartu",
  qris_edc: "QRIS EDC",
  qris_gopay: "QRIS GoPay",
  qris_ovo: "QRIS OVO",
  qris_other: "QRIS Lainnya",
  transfer: "Transfer",
  credit: "Piutang",
};

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

export function paymentMethodFromLegacy(
  method: "Tunai" | "QRIS" | "Transfer" | "Piutang",
): PaymentMethod {
  const map = {
    Tunai: "cash",
    QRIS: "qris_edc",
    Transfer: "transfer",
    Piutang: "credit",
  } as const;
  return map[method];
}

export const TX_STATUS_LABELS = {
  completed: "Selesai",
  voided: "Void",
  returned: "Retur",
} as const;

export const RETURN_STATUS_LABELS = {
  none: "",
  partial: "Proses Retur",
  full: "Retur Penuh",
} as const;

export const ORDER_FULFILLMENT_LABELS: Record<OrderFulfillmentType, string> = {
  cod: "COD",
  shipped: "Di Kirim",
  partial_shipped: "Di Kirim Sebagian",
};

export function orderFulfillmentLabel(type: OrderFulfillmentType): string {
  return ORDER_FULFILLMENT_LABELS[type] ?? type;
}

/** Order yang membutuhkan DO / modul Pengiriman (bukan COD ambil di toko). */
export function orderRequiresPhysicalDelivery(type: OrderFulfillmentType): boolean {
  return type === "shipped" || type === "partial_shipped";
}

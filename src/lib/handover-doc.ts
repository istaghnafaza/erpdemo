// =============================================================================
// Surat jalan + checklist serah terima (setelah bayar / reprint pengiriman)
// =============================================================================

import { isCartSoLine } from "@/lib/pos-so-checkout";
import type { PartialShipLine } from "@/lib/pos-partial-shipment";
import type { CartItem } from "@/types/database";
import type { DeliveryRecord } from "@/types/deliveries";
import type { OrderFulfillmentType } from "@/types/sales-transactions";

export interface HandoverLine {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  qtyOrdered: number;
  qtyHandover: number;
  isSoLine: boolean;
}

export interface HandoverDoc {
  title: string;
  storeName: string;
  branchName: string;
  branchAddress: string | null;
  branchPhone: string | null;
  transactionNumber: string;
  deliveryNumber: string | null;
  createdAt: string;
  cashierName: string;
  customerName: string | null;
  customerPhone: string | null;
  deliverySiteLabel: string | null;
  deliveryAddress: string | null;
  orderFulfillmentType: OrderFulfillmentType;
  driverName: string | null;
  vehiclePlate: string | null;
  lines: HandoverLine[];
}

export function formatHandoverQty(n: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(n);
}

export function handoverQtyForCartLine(
  item: CartItem,
  index: number,
  fulfillment: OrderFulfillmentType,
  partialShip: PartialShipLine[],
): number {
  if (isCartSoLine(item)) return 0;
  if (fulfillment === "partial_shipped") {
    return Math.max(0, partialShip[index]?.shipQty ?? 0);
  }
  return item.qty;
}

export function buildHandoverLinesFromCart(
  items: CartItem[],
  fulfillment: OrderFulfillmentType,
  partialShip: PartialShipLine[],
): HandoverLine[] {
  return items.map((item, index) => ({
    productId: item.product_id,
    sku: item.sku,
    name: item.name,
    unit: item.unit,
    qtyOrdered: item.qty,
    qtyHandover: handoverQtyForCartLine(item, index, fulfillment, partialShip),
    isSoLine: isCartSoLine(item),
  }));
}

export interface HandoverDocFromPosInput {
  storeName: string;
  branchName: string;
  branchAddress: string | null;
  branchPhone: string | null;
  transactionNumber: string;
  deliveryNumber?: string | null;
  createdAt: string;
  cashierName: string;
  customerName: string | null;
  customerPhone?: string | null;
  deliverySiteLabel: string | null;
  deliveryAddress: string | null;
  orderFulfillmentType: OrderFulfillmentType;
  handoverLines?: HandoverLine[];
  items?: CartItem[];
  fulfillmentPartialShip?: PartialShipLine[];
}

export function buildHandoverDocFromPos(input: HandoverDocFromPosInput): HandoverDoc {
  const lines =
    input.handoverLines ??
    buildHandoverLinesFromCart(
      input.items ?? [],
      input.orderFulfillmentType,
      input.fulfillmentPartialShip ?? [],
    );
  return {
    title: "Surat Jalan & Checklist Serah Terima",
    storeName: input.storeName || input.branchName,
    branchName: input.branchName,
    branchAddress: input.branchAddress,
    branchPhone: input.branchPhone,
    transactionNumber: input.transactionNumber,
    deliveryNumber: input.deliveryNumber ?? null,
    createdAt: input.createdAt,
    cashierName: input.cashierName,
    customerName: input.customerName,
    customerPhone: input.customerPhone ?? null,
    deliverySiteLabel: input.deliverySiteLabel,
    deliveryAddress: input.deliveryAddress,
    orderFulfillmentType: input.orderFulfillmentType,
    driverName: null,
    vehiclePlate: null,
    lines,
  };
}

export function buildHandoverLinesFromSaleItems(
  items: Array<{
    productId: string;
    sku: string;
    productName: string;
    unit: string;
    qty: number;
    isSoLine?: boolean;
  }>,
): HandoverLine[] {
  return items.map((item) => ({
    productId: item.productId,
    sku: item.sku,
    name: item.productName,
    unit: item.unit,
    qtyOrdered: item.qty,
    qtyHandover: item.isSoLine ? 0 : item.qty,
    isSoLine: item.isSoLine === true,
  }));
}

export function buildHandoverDocFromDelivery(delivery: DeliveryRecord): HandoverDoc {
  const soExtras: HandoverLine[] = [];
  return {
    title: "Surat Jalan & Checklist Serah Terima",
    storeName: delivery.branchName,
    branchName: delivery.branchName,
    branchAddress: null,
    branchPhone: null,
    transactionNumber: delivery.transactionNumber,
    deliveryNumber: delivery.deliveryNumber,
    createdAt: delivery.createdAt,
    cashierName: delivery.cashierName,
    customerName: delivery.customerName,
    customerPhone: delivery.customerPhone,
    deliverySiteLabel: delivery.deliverySiteLabel,
    deliveryAddress: delivery.deliveryAddress || null,
    orderFulfillmentType: delivery.orderFulfillmentType,
    driverName: delivery.driverName,
    vehiclePlate: delivery.vehiclePlate,
    lines: [
      ...delivery.items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.productName,
        unit: item.unit,
        qtyOrdered: item.qtyOrdered,
        qtyHandover: item.qtyToDeliver,
        isSoLine: false,
      })),
      ...soExtras,
    ],
  };
}

export function printByKind(kind: "receipt" | "handover"): void {
  document.body.dataset.print = kind;
  const cleanup = () => {
    delete document.body.dataset.print;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  window.setTimeout(cleanup, 1500);
}

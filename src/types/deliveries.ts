// =============================================================================
// Delivery records — material shipment tracking (demo/localStorage).
// Created automatically from POS checkout, not manually in this module.
// =============================================================================

import type { PaymentMethod } from "@/types/app";
import type { OrderFulfillmentType } from "@/types/sales-transactions";

export type DeliveryStatus =
  | "pending"
  | "preparing"
  | "in_transit"
  | "delivered"
  | "partial_delivered"
  | "cancelled";

export interface DeliveryItemRecord {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  qtyOrdered: number;
  /** Qty yang akan/sudah dikirim (partial order bisa < qtyOrdered). */
  qtyToDeliver: number;
  qtyDelivered: number;
}

export interface DeliveryRecord {
  id: string;
  tenantId: string;
  branchId: string;
  branchName: string;
  deliveryNumber: string;
  salesTransactionId: string;
  transactionNumber: string;
  orderFulfillmentType: OrderFulfillmentType;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string;
  deliverySiteId: string | null;
  deliverySiteLabel: string | null;
  cashierId: string;
  cashierName: string;
  paymentMethod: PaymentMethod;
  grandTotal: number;
  status: DeliveryStatus;
  scheduledDate: string | null;
  driverName: string | null;
  vehiclePlate: string | null;
  deliveredAt: string | null;
  notes: string | null;
  isOfflineSale: boolean;
  items: DeliveryItemRecord[];
}

export interface CreateDeliveryFromCheckoutDraft {
  tenantId: string;
  branchId: string;
  branchName: string;
  salesTransactionId: string;
  transactionNumber: string;
  orderFulfillmentType: OrderFulfillmentType;
  cashierId: string;
  cashierName: string;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string;
  deliverySiteId: string | null;
  deliverySiteLabel: string | null;
  paymentMethod: PaymentMethod;
  grandTotal: number;
  isOfflineSale: boolean;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    unit: string;
    qty: number;
    /** Qty yang dikirim (wajib untuk partial_shipped). */
    shipQty?: number;
  }>;
}

export interface UpdateDeliveryDraft {
  status?: DeliveryStatus;
  scheduledDate?: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
  notes?: string | null;
  deliveredAt?: string | null;
  items?: Array<{ id: string; qtyDelivered: number }>;
}

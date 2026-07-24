// =============================================================================
// Sales transaction records — UI/demo layer (localStorage, not Supabase yet).
// =============================================================================

import type { PaymentMethod } from "@/types/app";
import type { DbTxStatus } from "@/types/database";

/** Keterangan pengiriman / order di checkout POS. */
export type OrderFulfillmentType = "cod" | "shipped" | "partial_shipped";

export interface SalesTransactionItemRecord {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  qty: number;
  purchasePrice: number;
  sellingPrice: number;
  discount: number;
  subtotal: number;
  /** Tercatat di struk — barang ini masuk Sales Order untuk fulfillment */
  isSoLine?: boolean;
}

export interface SalesTransactionRecord {
  id: string;
  tenantId: string;
  branchId: string;
  branchName: string;
  transactionNumber: string;
  createdAt: string;
  cashierId: string;
  cashierName: string;
  customerName: string | null;
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeAmount: number;
  status: DbTxStatus;
  isOffline: boolean;
  orderFulfillmentType: OrderFulfillmentType;
  deliveryAddress: string | null;
  deliverySiteId: string | null;
  deliverySiteLabel: string | null;
  items: SalesTransactionItemRecord[];
}

export interface RecordSaleDraft {
  tenantId: string;
  branchId: string;
  branchName: string;
  transactionNumber: string;
  cashierId: string;
  cashierName: string;
  customerName: string | null;
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeAmount: number;
  isOffline: boolean;
  orderFulfillmentType: OrderFulfillmentType;
  deliveryAddress?: string | null;
  deliverySiteId?: string | null;
  deliverySiteLabel?: string | null;
  items: Omit<SalesTransactionItemRecord, "id">[];
}

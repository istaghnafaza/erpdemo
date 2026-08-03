// =============================================================================
// POS checkout side payloads — atomically processed with createSaleTransaction
// =============================================================================

import type { PaymentMethod } from "@/types/app";
import type { OrderFulfillmentType } from "@/types/sales-transactions";

export interface PosCheckoutDeliveryExtra {
  orderFulfillmentType: OrderFulfillmentType;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string;
  grandTotal: number;
}

export interface PosCheckoutSalesOrderItemExtra {
  product_id: string;
  product_name: string;
  sku: string;
  unit: string;
  qty: number;
  selling_price: number;
  discount: number;
}

export interface PosCheckoutSalesOrderExtra {
  customer_id: string | null;
  customer_name: string;
  delivery_address: string | null;
  discount_amount: number;
  down_payment: number;
  created_by: string;
  pos_transaction_number: string;
  items: PosCheckoutSalesOrderItemExtra[];
}

export interface PosCheckoutReturnOffsetExtra {
  returnId: string;
  offsetAmount: number;
}

export interface PosCheckoutExtras {
  delivery?: PosCheckoutDeliveryExtra;
  salesOrder?: PosCheckoutSalesOrderExtra;
  returnOffset?: PosCheckoutReturnOffsetExtra;
}

export interface BuildPosCheckoutExtrasInput {
  tenantId: string;
  branchId: string;
  cashierId: string;
  cart: {
    customer?: { id: string; name: string; phone?: string | null } | null;
    orderFulfillmentType: OrderFulfillmentType;
    deliveryAddress?: string | null;
    returnOffset?: { returnId: string; amount: number } | null;
    items: Array<{
      product_id: string;
      name: string;
      sku: string;
      unit: string;
      qty: number;
      selling_price: number;
      discount: number;
      subtotal: number;
      is_so_line?: boolean;
    }>;
    partialShip?: Array<{ shipQty?: number } | undefined>;
  };
  paymentMethod: PaymentMethod;
  discountAmount: number;
  grandTotal: number;
  amountPaid: number;
  transactionNumber: string;
}

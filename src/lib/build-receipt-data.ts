// =============================================================================
// Build receipt payload — POS checkout & histori penjualan
// =============================================================================

import {
  cartGrossSubtotal,
  cartTierDiscountTotal,
} from "@/lib/pos-line-pricing-display";
import type { CartItem } from "@/types/database";
import type { PaymentMethod } from "@/types/app";
import type {
  OrderFulfillmentType,
  SalesTransactionItemRecord,
  SalesTransactionRecord,
} from "@/types/sales-transactions";

export interface ReceiptLineItem {
  product_id: string;
  name: string;
  qty: number;
  unit: string;
  selling_price: number;
  discount: number;
  subtotal: number;
  base_selling_price?: number;
  volume_discount_percent?: number;
  customer_discount_percent?: number;
  is_so_line?: boolean;
}

export interface ReceiptData {
  transactionNumber: string;
  items: ReceiptLineItem[];
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change: number;
  isOffline: boolean;
  orderFulfillmentType: OrderFulfillmentType;
  cashierName: string;
  customerName: string | null;
  deliverySiteLabel: string | null;
  deliveryAddress: string | null;
  branchName: string;
  branchAddress: string | null;
  branchPhone: string | null;
  storeName: string;
  createdAt: string;
}

export function cartItemToReceiptLine(item: CartItem): ReceiptLineItem {
  return {
    product_id: item.product_id,
    name: item.name,
    qty: item.qty,
    unit: item.unit,
    selling_price: item.selling_price,
    discount: item.discount,
    subtotal: item.subtotal,
    base_selling_price: item.base_selling_price,
    volume_discount_percent: item.volume_discount_percent,
    customer_discount_percent: item.customer_discount_percent,
    is_so_line: item.is_so_line,
  };
}

export function salesItemToReceiptLine(item: SalesTransactionItemRecord): ReceiptLineItem {
  const base = item.sellingPrice + (item.discount ?? 0);
  return {
    product_id: item.productId,
    name: item.productName,
    qty: item.qty,
    unit: item.unit,
    selling_price: item.sellingPrice,
    discount: item.discount,
    subtotal: item.subtotal,
    base_selling_price: base > item.sellingPrice ? base : item.sellingPrice,
    is_so_line: item.isSoLine,
  };
}

export function receiptTotalSavings(data: ReceiptData): number {
  const cartLike = data.items.map(
    (item) =>
      ({
        ...item,
        branch_product_id: "",
        sku: "",
        purchase_price: 0,
        stock_source: "verified" as const,
        available_stock: 0,
      }) satisfies CartItem,
  );
  return cartGrossSubtotal(cartLike) - data.grandTotal;
}

export function receiptTierDiscountTotal(data: ReceiptData): number {
  const cartLike = data.items.map(
    (item) =>
      ({
        ...item,
        branch_product_id: "",
        sku: "",
        purchase_price: 0,
        stock_source: "verified" as const,
        available_stock: 0,
      }) satisfies CartItem,
  );
  return cartTierDiscountTotal(cartLike);
}

export function buildReceiptFromSalesTransaction(
  tx: SalesTransactionRecord,
  opts: {
    branchAddress?: string | null;
    branchPhone?: string | null;
    storeName?: string;
  } = {},
): ReceiptData {
  return {
    transactionNumber: tx.transactionNumber,
    items: tx.items.map(salesItemToReceiptLine),
    subtotal: tx.subtotal,
    discountAmount: tx.discountAmount,
    grandTotal: tx.grandTotal,
    paymentMethod: tx.paymentMethod,
    amountPaid: tx.amountPaid,
    change: tx.changeAmount,
    isOffline: tx.isOffline,
    orderFulfillmentType: tx.orderFulfillmentType,
    cashierName: tx.cashierName,
    customerName: tx.customerName,
    deliverySiteLabel: tx.deliverySiteLabel,
    deliveryAddress: tx.deliveryAddress,
    branchName: tx.branchName,
    branchAddress: opts.branchAddress ?? null,
    branchPhone: opts.branchPhone ?? null,
    storeName: opts.storeName ?? tx.branchName,
    createdAt: tx.createdAt,
  };
}

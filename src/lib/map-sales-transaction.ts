// =============================================================================
// Map DB sales rows → UI SalesTransactionRecord
// =============================================================================

import type { PaymentMethod } from "@/types/app";
import type { SalesItem, SalesTransaction } from "@/types/database";
import type { SalesTransactionRecord } from "@/types/sales-transactions";

export type SalesHistoryRow = SalesTransaction & {
  items: SalesItem[];
  branch_name: string;
  cashier_name: string;
};

export function mapSalesHistoryToRecord(row: SalesHistoryRow): SalesTransactionRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id,
    branchName: row.branch_name,
    transactionNumber: row.transaction_number,
    createdAt: row.created_at,
    cashierId: row.input_by ?? row.paid_by ?? "",
    cashierName: row.cashier_name,
    customerName: row.customer_name,
    customerId: row.customer_id,
    itemCount: row.items.length,
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    grandTotal: row.grand_total,
    paymentMethod: row.payment_method as PaymentMethod,
    amountPaid: row.amount_paid,
    changeAmount: row.change_amount,
    status: row.status,
    returnStatus: row.return_status,
    returnOffsetAmount: row.return_offset_amount,
    isOffline: row.is_offline_transaction,
    orderFulfillmentType: "cod",
    deliveryAddress: null,
    deliverySiteId: null,
    deliverySiteLabel: null,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.product_id ?? "",
      productName: item.product_name,
      sku: item.sku,
      unit: item.unit,
      qty: item.qty,
      purchasePrice: item.purchase_price,
      sellingPrice: item.selling_price,
      discount: item.discount,
      subtotal: item.subtotal,
      isSoLine: item.is_so_line === true,
      qtyReturned: item.qty_returned ?? 0,
    })),
  };
}

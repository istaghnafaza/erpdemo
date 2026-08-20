// =============================================================================
// Invoice / struk document builders (POS, SO, piutang)
// =============================================================================

import type { ReceiptData, ReceiptLineItem } from "@/lib/build-receipt-data";
import { buildReceiptFromSalesTransaction } from "@/lib/build-receipt-data";
import type { PaymentMethod } from "@/types/app";
import type { SalesItem, SalesOrder, SalesOrderItem, SalesTransaction } from "@/types/database";
import type { SalesTransactionRecord } from "@/types/sales-transactions";
import type { MockSalesOrderWithDetails } from "@/lib/mock-sales-orders";
import { mapSalesHistoryToRecord } from "@/lib/map-sales-transaction";

export interface InvoiceDoc extends ReceiptData {
  soNumber?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  remainingBalance?: number;
  customerPhone?: string | null;
}

export function receiptToInvoiceDoc(
  receipt: ReceiptData,
  extra: Partial<Pick<InvoiceDoc, "soNumber" | "dueDate" | "notes" | "remainingBalance" | "customerPhone">> = {},
): InvoiceDoc {
  const remaining =
    extra.remainingBalance ??
    (receipt.paymentMethod === "credit"
      ? Math.max(0, receipt.grandTotal - receipt.amountPaid)
      : 0);
  return { ...receipt, remainingBalance: remaining, ...extra };
}

export function invoiceFromSalesRecord(
  tx: SalesTransactionRecord,
  opts: {
    branchAddress?: string | null;
    branchPhone?: string | null;
    storeName?: string;
    soNumber?: string | null;
    dueDate?: string | null;
    notes?: string | null;
  } = {},
): InvoiceDoc {
  return receiptToInvoiceDoc(buildReceiptFromSalesTransaction(tx, opts), {
    soNumber: opts.soNumber,
    dueDate: opts.dueDate,
    notes: opts.notes,
  });
}

export function mapDbSaleToRecord(
  tx: SalesTransaction & { items: SalesItem[] },
  opts: { branchName: string; cashierName?: string },
): SalesTransactionRecord {
  return mapSalesHistoryToRecord({
    ...tx,
    items: tx.items,
    branch_name: opts.branchName,
    cashier_name: opts.cashierName ?? "Kasir",
  });
}

function soLinesToReceiptItems(items: SalesOrderItem[]): ReceiptLineItem[] {
  return items.map((item) => ({
    product_id: item.product_id ?? item.id,
    name: item.product_name,
    qty: item.qty,
    unit: item.unit,
    selling_price: item.selling_price,
    discount: item.discount,
    subtotal: item.subtotal,
  }));
}

export function docsFromSalesOrder(
  order: Pick<
    SalesOrder,
    | "so_number"
    | "customer_name"
    | "delivery_address"
    | "subtotal"
    | "discount_amount"
    | "grand_total"
    | "down_payment"
    | "remaining_payment"
    | "notes"
    | "created_at"
    | "estimated_delivery_date"
  > & {
    items: SalesOrderItem[];
    pos_transaction_number?: string | null;
    customer?: { name: string; phone: string | null };
  },
  opts: {
    branchName: string;
    branchAddress?: string | null;
    branchPhone?: string | null;
    storeName: string;
    cashierName?: string;
  },
): InvoiceDoc {
  const documentNumber = order.pos_transaction_number || order.so_number;
  const remaining = Math.max(0, order.remaining_payment);
  const paymentMethod: PaymentMethod = remaining > 0 ? "credit" : "transfer";
  const receipt: ReceiptData = {
    transactionNumber: documentNumber,
    items: soLinesToReceiptItems(order.items),
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    grandTotal: order.grand_total,
    paymentMethod,
    amountPaid: order.down_payment,
    change: 0,
    isOffline: false,
    orderFulfillmentType: "shipped",
    cashierName: opts.cashierName ?? "—",
    customerName: order.customer_name,
    deliverySiteLabel: null,
    deliveryAddress: order.delivery_address,
    branchName: opts.branchName,
    branchAddress: opts.branchAddress ?? null,
    branchPhone: opts.branchPhone ?? null,
    storeName: opts.storeName,
    createdAt: order.created_at,
  };
  return receiptToInvoiceDoc(receipt, {
    soNumber: order.so_number,
    dueDate: order.estimated_delivery_date,
    notes: order.notes,
    remainingBalance: remaining,
    customerPhone: order.customer?.phone ?? null,
  });
}

export function docsFromMockSalesOrder(
  order: MockSalesOrderWithDetails,
  opts: {
    branchName: string;
    branchAddress?: string | null;
    branchPhone?: string | null;
    storeName: string;
  },
): InvoiceDoc {
  return docsFromSalesOrder(order, opts);
}

export function summaryInvoiceFromAr(input: {
  documentNumber: string;
  customerName: string;
  amount: number;
  paid: number;
  dueDate: string;
  issuedDate: string;
  branchName: string;
  branchAddress?: string | null;
  branchPhone?: string | null;
  storeName: string;
}): InvoiceDoc {
  const remaining = Math.max(0, input.amount - input.paid);
  return receiptToInvoiceDoc(
    {
      transactionNumber: documentNumberFromArInvoice(input.documentNumber),
      items: [
        {
          product_id: "ar-summary",
          name: "Piutang pelanggan",
          qty: 1,
          unit: "ls",
          selling_price: input.amount,
          discount: 0,
          subtotal: input.amount,
        },
      ],
      subtotal: input.amount,
      discountAmount: 0,
      grandTotal: input.amount,
      paymentMethod: remaining > 0 ? "credit" : "transfer",
      amountPaid: input.paid,
      change: 0,
      isOffline: false,
      orderFulfillmentType: "cod",
      cashierName: "—",
      customerName: input.customerName,
      deliverySiteLabel: null,
      deliveryAddress: null,
      branchName: input.branchName,
      branchAddress: input.branchAddress ?? null,
      branchPhone: input.branchPhone ?? null,
      storeName: input.storeName,
      createdAt: input.issuedDate,
    },
    { dueDate: input.dueDate, remainingBalance: remaining },
  );
}

/** AR-TRX-… → TRX-… ; INV-SO-… stays until SO lookup; otherwise as-is. */
export function documentNumberFromArInvoice(invoice: string): string {
  if (invoice.startsWith("AR-")) return invoice.slice(3);
  if (invoice.startsWith("INV-")) return invoice.slice(4);
  return invoice;
}

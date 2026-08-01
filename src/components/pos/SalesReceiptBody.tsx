import { PosLinePricingBreakdown } from "@/components/pos/PosLinePricingBreakdown";
import {
  receiptTierDiscountTotal,
  receiptTotalSavings,
  type ReceiptData,
  type ReceiptLineItem,
} from "@/lib/build-receipt-data";
import { rupiah, tanggal } from "@/lib/format";
import { orderFulfillmentLabel } from "@/lib/sales-transaction-utils";
import type { CartItem } from "@/types/database";

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Tunai",
  card: "Kartu",
  qris_edc: "QRIS EDC",
  qris_gopay: "QRIS GoPay",
  qris_ovo: "QRIS OVO",
  qris_other: "QRIS Lainnya",
  transfer: "Transfer",
  credit: "Piutang",
};

function toCartItem(line: ReceiptLineItem): CartItem {
  return {
    product_id: line.product_id,
    branch_product_id: "",
    sku: "",
    name: line.name,
    unit: line.unit,
    qty: line.qty,
    selling_price: line.selling_price,
    purchase_price: 0,
    discount: line.discount,
    subtotal: line.subtotal,
    stock_source: "verified",
    available_stock: 0,
    is_so_line: line.is_so_line,
    base_selling_price: line.base_selling_price,
    volume_discount_percent: line.volume_discount_percent,
    customer_discount_percent: line.customer_discount_percent,
  };
}

export interface SalesReceiptBodyProps {
  receipt: ReceiptData;
  className?: string;
}

export function SalesReceiptBody({ receipt, className }: SalesReceiptBodyProps) {
  const tierDiscount = receiptTierDiscountTotal(receipt);
  const totalSavings = receiptTotalSavings(receipt);

  return (
    <div className={className ?? "border-2 border-dashed rounded-lg p-4 text-xs font-mono space-y-2 bg-muted/30"}>
      <div className="text-center pb-2 border-b border-dashed">
        <div className="font-bold text-sm font-sans">{receipt.branchName}</div>
        {receipt.branchAddress && (
          <div className="text-[10px] font-sans text-muted-foreground mt-0.5">
            {receipt.branchAddress}
          </div>
        )}
        {receipt.branchPhone && (
          <div className="text-[10px] font-sans text-muted-foreground">
            WA: {receipt.branchPhone}
          </div>
        )}
      </div>
      <div className="flex justify-between text-[10px]">
        <span>{tanggal(receipt.createdAt, { withTime: true })}</span>
        <span>Kasir: {receipt.cashierName}</span>
      </div>
      <div className="text-[10px] font-mono">{receipt.transactionNumber}</div>
      {receipt.customerName && (
        <div className="text-[10px]">Pelanggan: {receipt.customerName}</div>
      )}
      <div className="text-[10px]">
        Order: {orderFulfillmentLabel(receipt.orderFulfillmentType ?? "cod")}
      </div>
      {receipt.deliverySiteLabel && (
        <div className="text-[10px]">Proyek: {receipt.deliverySiteLabel}</div>
      )}
      {receipt.deliveryAddress && (
        <div className="text-[10px] text-muted-foreground">{receipt.deliveryAddress}</div>
      )}
      <div className="space-y-2 py-2 border-y border-dashed">
        {receipt.items.map((it, i) => (
          <div key={`${it.product_id}-${i}`}>
            <div>{it.name}</div>
            <div className="flex justify-between gap-2">
              <PosLinePricingBreakdown item={toCartItem(it)} variant="receipt" className="flex-1" />
              <span className="text-[10px] shrink-0">{rupiah(it.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px]">
        <span>Subtotal</span>
        <span>{rupiah(receipt.subtotal)}</span>
      </div>
      {tierDiscount > 0 && (
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Diskon tier barang</span>
          <span>−{rupiah(tierDiscount)}</span>
        </div>
      )}
      {receipt.discountAmount > 0 && (
        <div className="flex justify-between text-[10px]">
          <span>Diskon keranjang</span>
          <span>−{rupiah(receipt.discountAmount)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-sm">
        <span>TOTAL</span>
        <span>{rupiah(receipt.grandTotal)}</span>
      </div>
      <div className="flex justify-between text-[10px]">
        <span>Bayar ({PAYMENT_LABEL[receipt.paymentMethod] ?? receipt.paymentMethod})</span>
        <span>{rupiah(receipt.amountPaid)}</span>
      </div>
      {receipt.change > 0 && (
        <div className="flex justify-between text-[10px]">
          <span>Kembalian</span>
          <span>{rupiah(receipt.change)}</span>
        </div>
      )}
      {receipt.paymentMethod === "credit" && receipt.amountPaid < receipt.grandTotal && (
        <>
          <div className="flex justify-between text-[10px]">
            <span>DP diterima</span>
            <span>{rupiah(receipt.amountPaid)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-medium">
            <span>Sisa piutang</span>
            <span>{rupiah(receipt.grandTotal - receipt.amountPaid)}</span>
          </div>
        </>
      )}
      {receipt.isOffline && (
        <div className="text-center pt-1 text-[10px] font-sans font-semibold text-warning-foreground bg-warning/20 rounded py-1">
          [OFFLINE — Pending Sync]
        </div>
      )}
      <div className="text-center pt-2 border-t border-dashed text-[10px] font-sans leading-relaxed">
        {totalSavings > 0 ? (
          <>
            Terima kasih, Anda hemat {rupiah(totalSavings)} dengan berbelanja di {receipt.storeName}
          </>
        ) : (
          <>Terima kasih telah berbelanja di {receipt.storeName}</>
        )}
      </div>
    </div>
  );
}

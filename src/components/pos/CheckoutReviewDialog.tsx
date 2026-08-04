import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { rupiah } from "@/lib/format";
import { orderFulfillmentLabel } from "@/lib/sales-transaction-utils";
import { PosLinePricingBreakdown } from "@/components/pos/PosLinePricingBreakdown";
import { ReturnOffsetSummary } from "@/components/pos/ReturnOffsetLines";
import type { ActiveCart } from "@/stores/pos.store";
import type { PaymentMethod } from "@/types/app";
import type { OrderFulfillmentType } from "@/types/sales-transactions";

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

export interface CheckoutReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: ActiveCart;
  subtotal: number;
  discountAmount: number;
  total: number;
  orderFulfillmentType: OrderFulfillmentType;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change: number;
  creditDebt: number;
  isProcessing: boolean;
  onConfirm: () => void;
}

export function CheckoutReviewDialog({
  open,
  onOpenChange,
  cart,
  subtotal,
  discountAmount,
  total,
  orderFulfillmentType,
  paymentMethod,
  amountPaid,
  change,
  creditDebt,
  isProcessing,
  onConfirm,
}: CheckoutReviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Transaksi</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pelanggan</span>
              <span className="font-medium">{cart.customer?.name ?? "Pelanggan Umum"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order</span>
              <span>{orderFulfillmentLabel(orderFulfillmentType)}</span>
            </div>
            {cart.deliverySiteLabel && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">Lokasi / Proyek</span>
                <span className="text-right">{cart.deliverySiteLabel}</span>
              </div>
            )}
            {cart.deliveryAddress && (
              <div className="text-xs text-muted-foreground pt-1 border-t mt-1">
                {cart.deliveryAddress}
              </div>
            )}
          </div>

          <div className="rounded-lg border divide-y">
            {cart.items.map((item, i) => (
              <div key={`${item.product_id}-${i}`} className="px-3 py-2 flex justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm leading-tight">{item.name}</div>
                  <div className="mt-0.5">
                    <PosLinePricingBreakdown item={item} variant="review" />
                    {item.is_so_line && (
                      <Badge variant="outline" className="mt-1 text-[10px] text-indigo-600 border-indigo-300">
                        SO
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="font-medium shrink-0">{rupiah(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal barang</span>
              <span>{rupiah(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Diskon keranjang</span>
                <span>−{rupiah(discountAmount)}</span>
              </div>
            )}
            {cart.returnOffset && cart.returnOffset.amount > 0 && (
              <div className="pt-1">
                <ReturnOffsetSummary offset={cart.returnOffset} />
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t">
              <span>Total</span>
              <span>{rupiah(total)}</span>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Metode bayar</span>
              <span className="font-medium">
                {PAYMENT_LABEL[paymentMethod] ?? paymentMethod}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {paymentMethod === "credit" ? "DP diterima" : "Jumlah bayar"}
              </span>
              <span className="font-medium">{rupiah(amountPaid)}</span>
            </div>
            {paymentMethod === "cash" && change > 0 && (
              <div className="flex justify-between text-success font-medium">
                <span>Kembalian</span>
                <span>{rupiah(change)}</span>
              </div>
            )}
            {paymentMethod === "credit" && creditDebt > 0 && (
              <div className="flex justify-between font-medium">
                <span>Sisa piutang</span>
                <span>{rupiah(creditDebt)}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Pastikan data sudah benar. Setelah dikonfirmasi, transaksi masuk ke histori penjualan.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Kembali
          </Button>
          <Button
            className="bg-gradient-primary hover:opacity-90"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? "Memproses..." : "Konfirmasi & Proses"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

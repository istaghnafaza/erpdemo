import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { rupiah, tanggal } from "@/lib/format";
import { Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { orderFulfillmentLabel } from "@/lib/sales-transaction-utils";
import type { PosState } from "@/stores/pos.store";

// -----------------------------------------------------------------------------
// ReceiptModal — post-payment success screen with a print-style receipt
// preview. Shows an [OFFLINE - Pending Sync] tag when the sale was queued.
// -----------------------------------------------------------------------------

type Receipt = NonNullable<PosState["lastReceipt"]>;

export interface ReceiptModalProps {
  receipt: Receipt | null;
  onClose: () => void;
  onNewTransaction: () => void;
}

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

export function ReceiptModal({ receipt, onClose, onNewTransaction }: ReceiptModalProps) {
  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <div className="text-center pt-2">
          <div className="h-14 w-14 mx-auto rounded-full bg-gradient-success grid place-items-center mb-2">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div className="font-semibold">Transaksi Berhasil</div>
          <div className="text-xs text-muted-foreground font-mono">
            {receipt?.transactionNumber}
          </div>
        </div>

        {receipt && (
          <div className="border-2 border-dashed rounded-lg p-4 text-xs font-mono space-y-2 bg-muted/30">
            <div className="text-center pb-2 border-b border-dashed">
              <div className="font-bold text-sm font-sans">{receipt.branchName}</div>
              {receipt.branchAddress && (
                <div className="text-[10px] font-sans text-muted-foreground">
                  {receipt.branchAddress}
                </div>
              )}
            </div>
            <div className="flex justify-between text-[10px]">
              <span>{tanggal(new Date().toISOString(), { withTime: true })}</span>
              <span>Kasir: {receipt.cashierName}</span>
            </div>
            {receipt.customerName && (
              <div className="text-[10px]">Pelanggan: {receipt.customerName}</div>
            )}
            <div className="text-[10px]">
              Order: {orderFulfillmentLabel(receipt.orderFulfillmentType ?? "cod")}
            </div>
            {receipt.deliverySiteLabel && (
              <div className="text-[10px]">
                Proyek: {receipt.deliverySiteLabel}
              </div>
            )}
            {receipt.deliveryAddress && (
              <div className="text-[10px] text-muted-foreground">{receipt.deliveryAddress}</div>
            )}
            <div className="space-y-1 py-2 border-y border-dashed">
              {receipt.items.map((it, i) => (
                <div key={i}>
                  <div>{it.name}</div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>
                      {it.qty} × {rupiah(it.selling_price)}
                    </span>
                    <span>{rupiah(it.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Subtotal</span>
              <span>{rupiah(receipt.subtotal)}</span>
            </div>
            {receipt.discountAmount > 0 && (
              <div className="flex justify-between text-[10px]">
                <span>Diskon</span>
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
            <div className="text-center pt-2 border-t border-dashed text-[10px] font-sans">
              Terima kasih atas kunjungan Anda
            </div>
          </div>
        )}

        <DialogFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onNewTransaction}>
            Transaksi Baru
          </Button>
          <Button
            className="bg-gradient-primary"
            onClick={() => {
              toast.success("Struk dikirim ke printer");
              window.print();
            }}
          >
            <Printer className="h-4 w-4 mr-1.5" /> Cetak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

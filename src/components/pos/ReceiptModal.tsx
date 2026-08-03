import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SalesReceiptBody } from "@/components/pos/SalesReceiptBody";
import { cartItemToReceiptLine, type ReceiptData } from "@/lib/build-receipt-data";
import { Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
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

function toReceiptData(receipt: Receipt): ReceiptData {
  return {
    transactionNumber: receipt.transactionNumber,
    items: receipt.items.map(cartItemToReceiptLine),
    subtotal: receipt.subtotal,
    discountAmount: receipt.discountAmount,
    grandTotal: receipt.grandTotal,
    paymentMethod: receipt.paymentMethod,
    amountPaid: receipt.amountPaid,
    change: receipt.change,
    isOffline: receipt.isOffline,
    orderFulfillmentType: receipt.orderFulfillmentType,
    cashierName: receipt.cashierName,
    customerName: receipt.customerName,
    deliverySiteLabel: receipt.deliverySiteLabel,
    deliveryAddress: receipt.deliveryAddress,
    branchName: receipt.branchName,
    branchAddress: receipt.branchAddress,
    branchPhone: receipt.branchPhone,
    storeName: receipt.storeName,
    createdAt: receipt.createdAt,
    returnOffsetAmount: receipt.returnOffset?.amount,
    returnNumber: receipt.returnOffset?.returnNumber ?? null,
    returnOffsetItems: receipt.returnOffset?.items,
  };
}

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

        {receipt && <SalesReceiptBody receipt={toReceiptData(receipt)} />}

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

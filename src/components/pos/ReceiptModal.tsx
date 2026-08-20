import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SalesReceiptBody } from "@/components/pos/SalesReceiptBody";
import { HandoverPrintSheet } from "@/components/print/HandoverPrintSheet";
import { PrintPortal } from "@/components/print/PrintPortal";
import { PrintPaperControls } from "@/components/print/PrintPaperControls";
import { SalesInvoiceSheet } from "@/components/print/SalesInvoiceSheet";
import { cartItemToReceiptLine, type ReceiptData } from "@/lib/build-receipt-data";
import { receiptToInvoiceDoc } from "@/lib/print-docs";
import { printByKind } from "@/lib/print-page";
import { printPrefsScope, usePrintPrefs } from "@/hooks/usePrintPrefs";
import { buildHandoverDocFromPos } from "@/lib/handover-doc";
import { ClipboardList, FileText, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { PosState } from "@/stores/pos.store";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { cn } from "@/lib/utils";
import { ThermerPrintButton, ThermerTestLinks } from "@/components/print/ThermerPrintButton";

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
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const branchId = useBranchStore((s) => s.activeBranch?.id);
  const { prefs, widthMm, setReceiptPreset, setCustomMm, setInvoicePaper, setThermerOrigin } =
    usePrintPrefs(printPrefsScope(tenantId, branchId));

  const receiptData = receipt ? toReceiptData(receipt) : null;
  const invoiceDoc = receiptData
    ? receiptToInvoiceDoc(receiptData, { customerPhone: receipt?.customerPhone ?? null })
    : null;

  const handoverDoc = receipt
    ? buildHandoverDocFromPos({
        storeName: receipt.storeName,
        branchName: receipt.branchName,
        branchAddress: receipt.branchAddress,
        branchPhone: receipt.branchPhone,
        transactionNumber: receipt.transactionNumber,
        deliveryNumber: receipt.deliveryNumber,
        createdAt: receipt.createdAt,
        cashierName: receipt.cashierName,
        customerName: receipt.customerName,
        customerPhone: receipt.customerPhone,
        deliverySiteLabel: receipt.deliverySiteLabel,
        deliveryAddress: receipt.deliveryAddress,
        orderFulfillmentType: receipt.orderFulfillmentType,
        handoverLines: receipt.handoverLines,
        items: receipt.items,
      })
    : null;

  return (
    <>
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <div className="no-print text-center pt-2">
          <div className="h-14 w-14 mx-auto rounded-full bg-gradient-success grid place-items-center mb-2">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div className="font-semibold">Transaksi Berhasil</div>
          <div className="text-xs text-muted-foreground font-mono">
            {receipt?.transactionNumber}
          </div>
        </div>

        {receiptData && (
          <div className="no-print">
            <div
              className={cn(widthMm <= 60 && "text-[10px]")}
              style={{ width: `${Math.min(widthMm, 280)}mm`, maxWidth: "100%" }}
            >
              <SalesReceiptBody receipt={receiptData} />
            </div>
          </div>
        )}

        <PrintPaperControls
          prefs={prefs}
          onPreset={setReceiptPreset}
          onCustomMm={setCustomMm}
          onInvoicePaper={setInvoicePaper}
          onThermerOrigin={setThermerOrigin}
        />

        <DialogFooter className="no-print flex-col gap-2 sm:flex-col sm:space-x-0">
          <div className="grid grid-cols-2 gap-2 w-full">
            <Button variant="outline" onClick={onNewTransaction}>
              Transaksi Baru
            </Button>
            <Button
              className="bg-gradient-primary"
              onClick={() => {
                toast.success("Struk dikirim ke printer");
                printByKind("receipt", { receiptWidthMm: widthMm });
              }}
            >
              <Printer className="h-4 w-4 mr-1.5" /> Cetak Struk
            </Button>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              toast.success("Invoice dikirim ke printer");
              printByKind("invoice", { invoicePaper: prefs.invoicePaper });
            }}
          >
            <FileText className="h-4 w-4 mr-1.5" /> Cetak Invoice ({prefs.invoicePaper.toUpperCase()})
          </Button>
          {handoverDoc ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                toast.success("Surat jalan dikirim ke printer");
                printByKind("handover");
              }}
            >
              <ClipboardList className="h-4 w-4 mr-1.5" /> Cetak Surat Jalan
            </Button>
          ) : null}
          {receiptData ? (
            <div className="w-full space-y-2">
              <ThermerPrintButton receipt={receiptData} publicOrigin={prefs.thermerOrigin} />
              <ThermerPrintButton sample publicOrigin={prefs.thermerOrigin} />
              <ThermerTestLinks publicOrigin={prefs.thermerOrigin} />
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {receiptData && invoiceDoc ? (
      <PrintPortal>
        <div
          className={cn("receipt-print-root print-only", widthMm <= 60 && "receipt-print-narrow")}
          style={{ ["--print-receipt-width" as string]: `${widthMm}mm` }}
        >
          <SalesReceiptBody
            receipt={receiptData}
            className={cn("p-1 font-mono space-y-2", widthMm <= 60 ? "text-[9px]" : "text-xs")}
          />
        </div>
        <SalesInvoiceSheet doc={invoiceDoc} paper={prefs.invoicePaper} className="print-only p-0" />
        {handoverDoc ? <HandoverPrintSheet doc={handoverDoc} className="print-only p-4" /> : null}
      </PrintPortal>
    ) : null}
    </>
  );
}

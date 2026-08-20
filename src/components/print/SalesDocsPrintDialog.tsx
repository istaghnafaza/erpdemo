import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesReceiptBody } from "@/components/pos/SalesReceiptBody";
import { SalesInvoiceSheet } from "@/components/print/SalesInvoiceSheet";
import { PrintPortal } from "@/components/print/PrintPortal";
import { PrintPaperControls } from "@/components/print/PrintPaperControls";
import { printPrefsScope, usePrintPrefs } from "@/hooks/usePrintPrefs";
import { receiptToInvoiceDoc, type InvoiceDoc } from "@/lib/print-docs";
import type { ReceiptData } from "@/lib/build-receipt-data";
import { printByKind } from "@/lib/print-page";
import { FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ThermerPrintButton, ThermerTestLinks } from "@/components/print/ThermerPrintButton";

export interface SalesDocsPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ReceiptData | null;
  invoice?: InvoiceDoc | null;
  tenantId: string;
  branchId?: string | null;
  title?: string;
}

export function SalesDocsPrintDialog({
  open,
  onOpenChange,
  receipt,
  invoice,
  tenantId,
  branchId,
  title,
}: SalesDocsPrintDialogProps) {
  const { prefs, widthMm, setReceiptPreset, setCustomMm, setInvoicePaper, setThermerOrigin } =
    usePrintPrefs(printPrefsScope(tenantId, branchId));
  const invoiceDoc = invoice ?? (receipt ? receiptToInvoiceDoc(receipt) : null);

  if (!receipt && !invoiceDoc) return null;
  const docNumber = receipt?.transactionNumber ?? invoiceDoc?.transactionNumber ?? "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle className="font-mono text-sm">
              {title ?? "Cetak"} — {docNumber}
            </DialogTitle>
          </DialogHeader>

          <PrintPaperControls
            prefs={prefs}
            onPreset={setReceiptPreset}
            onCustomMm={setCustomMm}
            onInvoicePaper={setInvoicePaper}
            onThermerOrigin={setThermerOrigin}
          />

          <Tabs defaultValue={receipt ? "struk" : "invoice"} className="no-print">
            <TabsList className="w-full">
              {receipt ? (
                <TabsTrigger value="struk" className="flex-1">
                  Preview struk
                </TabsTrigger>
              ) : null}
              {invoiceDoc ? (
                <TabsTrigger value="invoice" className="flex-1">
                  Preview invoice
                </TabsTrigger>
              ) : null}
            </TabsList>
            {receipt ? (
              <TabsContent value="struk" className="mt-3">
                <div className="overflow-x-auto">
                  <div
                    className={cn(widthMm <= 60 && "text-[10px]")}
                    style={{ width: `${widthMm}mm`, maxWidth: "100%" }}
                  >
                    <SalesReceiptBody receipt={receipt} />
                  </div>
                </div>
              </TabsContent>
            ) : null}
            {invoiceDoc ? (
              <TabsContent value="invoice" className="mt-3">
                <div className="overflow-x-auto rounded-md border bg-white p-3">
                  <SalesInvoiceSheet
                    doc={invoiceDoc}
                    paper={prefs.invoicePaper}
                    className={prefs.invoicePaper === "a5" ? "max-w-[148mm]" : "max-w-[210mm]"}
                  />
                </div>
              </TabsContent>
            ) : null}
          </Tabs>

          <DialogFooter className="no-print gap-2 flex-wrap">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
            {receipt ? (
              <Button
                variant="secondary"
                onClick={() => {
                  toast.success("Struk dikirim ke printer");
                  printByKind("receipt", { receiptWidthMm: widthMm });
                }}
              >
                <Printer className="h-4 w-4 mr-1.5" /> Cetak Struk
              </Button>
            ) : null}
            {invoiceDoc ? (
              <Button
                className="bg-gradient-primary"
                onClick={() => {
                  toast.success("Invoice dikirim ke printer");
                  printByKind("invoice", { invoicePaper: prefs.invoicePaper });
                }}
              >
                <FileText className="h-4 w-4 mr-1.5" /> Cetak Invoice
              </Button>
            ) : null}
          </DialogFooter>
          {receipt ? (
            <div className="no-print space-y-2 border-t pt-3">
              <ThermerPrintButton receipt={receipt} publicOrigin={prefs.thermerOrigin} />
              <ThermerPrintButton sample publicOrigin={prefs.thermerOrigin} />
              <ThermerTestLinks publicOrigin={prefs.thermerOrigin} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {open ? (
        <PrintPortal>
          {receipt ? (
            <div
              className={cn(
                "receipt-print-root print-only",
                widthMm <= 60 && "receipt-print-narrow",
              )}
              style={{ ["--print-receipt-width" as string]: `${widthMm}mm` }}
            >
              <SalesReceiptBody
                receipt={receipt}
                className={cn(
                  "p-1 font-mono space-y-2",
                  widthMm <= 60 ? "text-[9px]" : "text-xs",
                )}
              />
            </div>
          ) : null}
          {invoiceDoc ? (
            <SalesInvoiceSheet
              doc={invoiceDoc}
              paper={prefs.invoicePaper}
              className="print-only p-0"
            />
          ) : null}
        </PrintPortal>
      ) : null}
    </>
  );
}

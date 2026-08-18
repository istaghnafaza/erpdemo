import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HandoverPrintSheet } from "@/components/print/HandoverPrintSheet";
import { PrintPortal } from "@/components/print/PrintPortal";
import { printByKind, type HandoverDoc } from "@/lib/handover-doc";
import { Printer } from "lucide-react";
import { toast } from "sonner";

export function HandoverPrintDialog({
  open,
  onOpenChange,
  doc,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: HandoverDoc | null;
}) {
  if (!doc) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle>Surat Jalan — {doc.transactionNumber}</DialogTitle>
          </DialogHeader>
          <HandoverPrintSheet doc={doc} className="no-print rounded-md border p-4" />
          <DialogFooter className="no-print gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
            <Button
              className="bg-gradient-primary"
              onClick={() => {
                toast.success("Surat jalan dikirim ke printer");
                printByKind("handover");
              }}
            >
              <Printer className="h-4 w-4 mr-1.5" /> Cetak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {open ? (
        <PrintPortal>
          <HandoverPrintSheet doc={doc} className="print-only p-4" />
        </PrintPortal>
      ) : null}
    </>
  );
}

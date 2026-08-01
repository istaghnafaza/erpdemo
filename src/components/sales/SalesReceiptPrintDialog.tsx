import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SalesReceiptBody } from "@/components/pos/SalesReceiptBody";
import type { ReceiptData } from "@/lib/build-receipt-data";
import { Printer } from "lucide-react";
import { toast } from "sonner";

export interface SalesReceiptPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ReceiptData | null;
}

export function SalesReceiptPrintDialog({
  open,
  onOpenChange,
  receipt,
}: SalesReceiptPrintDialogProps) {
  if (!receipt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Struk — {receipt.transactionNumber}</DialogTitle>
        </DialogHeader>
        <SalesReceiptBody receipt={receipt} />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
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

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rupiah, tanggal } from "@/lib/format";

// -----------------------------------------------------------------------------
// OpenShiftModal — blocks the POS screen until the cashier opens a shift.
// -----------------------------------------------------------------------------

export interface OpenShiftModalProps {
  open: boolean;
  cashierName: string;
  branchName: string;
  isLoading: boolean;
  error: string | null;
  onConfirm: (openingBalance: number) => void;
}

export function OpenShiftModal({
  open,
  cashierName,
  branchName,
  isLoading,
  error,
  onConfirm,
}: OpenShiftModalProps) {
  const [cash, setCash] = useState("500000");

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle>Buka Shift Kasir</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg bg-muted p-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Kasir</span>
              <span className="font-medium">{cashierName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cabang</span>
              <span className="font-medium">{branchName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mulai</span>
              <span className="font-medium">
                {tanggal(new Date().toISOString(), { withTime: true })}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opening-cash">Saldo kas awal (Rp)</Label>
            <Input
              id="opening-cash"
              inputMode="numeric"
              value={cash ? Number(cash).toLocaleString("id-ID") : ""}
              onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))}
              className="text-lg h-11"
            />
            <p className="text-xs text-muted-foreground">
              Total uang tunai di laci kasir saat ini: {rupiah(Number(cash) || 0)}
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            className="bg-gradient-primary w-full"
            disabled={isLoading}
            onClick={() => onConfirm(Number(cash) || 0)}
          >
            {isLoading ? "Membuka Shift..." : "Buka Shift & Mulai Transaksi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

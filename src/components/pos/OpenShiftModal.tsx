import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rupiah, tanggal } from "@/lib/format";

// -----------------------------------------------------------------------------
// OpenShiftModal — cashier must confirm opening cash, or go back without a shift.
// -----------------------------------------------------------------------------

export interface OpenShiftModalProps {
  open: boolean;
  cashierName: string;
  branchName: string;
  isLoading: boolean;
  error: string | null;
  onConfirm: (openingBalance: number) => void;
  onCancel: () => void;
}

export function OpenShiftModal({
  open,
  cashierName,
  branchName,
  isLoading,
  error,
  onConfirm,
  onCancel,
}: OpenShiftModalProps) {
  const [cash, setCash] = useState("");

  const openingBalance = Number(cash) || 0;

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          if (!isLoading) onCancel();
        }}
      >
        <DialogHeader>
          <DialogTitle>Buka Shift Kasir</DialogTitle>
          <DialogDescription>
            Shift belum dibuka. Isi saldo kas di laci, atau kembali jika belum siap.
          </DialogDescription>
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
              placeholder="0"
              value={cash ? Number(cash).toLocaleString("id-ID") : ""}
              onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))}
              className="text-lg h-11"
            />
            <p className="text-xs text-muted-foreground">
              Total uang tunai di laci kasir saat ini: {rupiah(openingBalance)}
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="flex-1 sm:flex-none"
            disabled={isLoading}
            onClick={onCancel}
          >
            Kembali
          </Button>
          <Button
            type="button"
            className="bg-gradient-primary flex-1 sm:flex-none"
            disabled={isLoading}
            onClick={() => onConfirm(openingBalance)}
          >
            {isLoading ? "Membuka Shift..." : "Buka Shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

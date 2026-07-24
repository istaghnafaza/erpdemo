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
import { AlertTriangle } from "lucide-react";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CashierSession } from "@/types/database";

// -----------------------------------------------------------------------------
// CloseShiftModal — shift summary + physical cash count + auto-computed
// discrepancy warning.
// -----------------------------------------------------------------------------

export interface CloseShiftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: CashierSession;
  isLoading: boolean;
  hasActiveCarts: boolean;
  onConfirm: (actualBalance: number, notes?: string) => void;
}

export function CloseShiftModal({
  open,
  onOpenChange,
  session,
  isLoading,
  hasActiveCarts,
  onConfirm,
}: CloseShiftModalProps) {
  const [actualCash, setActualCash] = useState(String(session.expected_cash_balance));
  const [notes, setNotes] = useState("");

  const actualNum = Number(actualCash) || 0;
  const discrepancy = actualNum - session.expected_cash_balance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tutup Shift Kasir</DialogTitle>
        </DialogHeader>

        {hasActiveCarts && (
          <div className="rounded-lg bg-warning/15 text-warning-foreground text-xs p-2.5 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Masih ada keranjang aktif (belum dibayar). Selesaikan atau kosongkan dulu sebelum
              menutup shift.
            </span>
          </div>
        )}

        <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Transaksi</span>
            <span className="font-medium">{session.total_transactions}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Penjualan</span>
            <span className="font-semibold">{rupiah(session.total_sales)}</span>
          </div>
          <div className="border-t pt-2 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Tunai</span>
              <span>{rupiah(session.total_cash_sales)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Kartu / QRIS</span>
              <span>{rupiah(session.total_card_sales)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Transfer</span>
              <span>{rupiah(session.total_transfer_sales)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Piutang</span>
              <span>{rupiah(session.total_credit_sales)}</span>
            </div>
          </div>
          <div className="border-t pt-2 flex justify-between">
            <span className="text-muted-foreground">Kas Awal</span>
            <span>{rupiah(session.opening_cash_balance)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Kas Seharusnya (Sistem)</span>
            <span>{rupiah(session.expected_cash_balance)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="actual-cash">Kas Aktual (hitung fisik) — Rp</Label>
          <Input
            id="actual-cash"
            inputMode="numeric"
            value={actualCash ? Number(actualCash).toLocaleString("id-ID") : ""}
            onChange={(e) => setActualCash(e.target.value.replace(/\D/g, ""))}
            className="text-lg h-11"
          />
        </div>

        {discrepancy !== 0 && (
          <div
            className={cn(
              "rounded-lg p-3 flex justify-between items-center text-sm",
              discrepancy < 0
                ? "bg-destructive/10 text-destructive"
                : "bg-warning/15 text-warning-foreground",
            )}
          >
            <span className="font-medium">{discrepancy < 0 ? "Kurang" : "Lebih"}</span>
            <span className="text-lg font-bold">{rupiah(Math.abs(discrepancy))}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="close-notes">Catatan (opsional)</Label>
          <Input
            id="close-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contoh: selisih karena kembalian kurang"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            className="bg-gradient-primary"
            disabled={isLoading || hasActiveCarts}
            onClick={() => onConfirm(actualNum, notes || undefined)}
          >
            {isLoading ? "Menutup Shift..." : "Tutup Shift & Setor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

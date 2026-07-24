import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { rupiah, tanggal } from "@/lib/format";
import { RefreshCw, Inbox } from "lucide-react";
import type { PosHeldCart } from "@/hooks/usePos";

// -----------------------------------------------------------------------------
// TakeoverModal — list held carts from other cashiers, allow taking one over
// into the current cashier's active tab.
// -----------------------------------------------------------------------------

export interface TakeoverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heldCarts: PosHeldCart[];
  onTakeover: (cart: PosHeldCart) => void;
}

export function TakeoverModal({ open, onOpenChange, heldCarts, onTakeover }: TakeoverModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ambil Alih Pesanan</DialogTitle>
        </DialogHeader>

        {heldCarts.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Tidak ada keranjang yang di-hold"
            description="Semua keranjang kasir lain sudah selesai atau tidak ada yang menunggu."
          />
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left font-medium py-2 px-2">Kasir</th>
                  <th className="text-left font-medium py-2 px-2">Pelanggan</th>
                  <th className="text-right font-medium py-2 px-2">Total</th>
                  <th className="text-right font-medium py-2 px-2">Waktu Hold</th>
                  <th className="text-right font-medium py-2 px-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {heldCarts.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2.5 px-2 font-medium">{c.cashierName}</td>
                    <td className="py-2.5 px-2">{c.customer?.name ?? "Umum"}</td>
                    <td className="py-2.5 px-2 text-right">{rupiah(c.total)}</td>
                    <td className="py-2.5 px-2 text-right text-xs text-muted-foreground">
                      {tanggal(c.heldAt, { withTime: true })}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => onTakeover(c)}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Ambil Alih
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { poTypeLabel } from "@/stores/purchasing.store";
import type { MockPoWithItems } from "@/lib/mock-purchasing";

interface GoodsReceiptFormDialogProps {
  open: boolean;
  po: MockPoWithItems | null;
  onClose: () => void;
  loading: boolean;
  onSubmit: (
    receivedQties: Record<string, number>,
    notes: string | null,
  ) => Promise<{ success: boolean; error?: string; grNumber?: string }>;
}

export function GoodsReceiptFormDialog({
  open,
  po,
  onClose,
  loading,
  onSubmit,
}: GoodsReceiptFormDialogProps) {
  const [qties, setQties] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !po) return;
    const initial: Record<string, number> = {};
    for (const item of po.items) {
      const remaining = item.ordered_qty - item.received_qty;
      initial[item.id] = remaining;
    }
    setQties(initial);
    setNotes("");
    setError(null);
  }, [open, po]);

  if (!po) return null;

  const handleSubmit = async () => {
    setError(null);
    const result = await onSubmit(qties, notes.trim() || null);
    if (!result.success) setError(result.error ?? "Gagal mencatat GR");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Penerimaan Barang
            <Badge className={po.type === "indent" ? "bg-violet-600" : ""}>
              {poTypeLabel(po.type)}
            </Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            PO {po.po_number} · {po.supplier?.name}
          </p>
        </DialogHeader>

        {po.type === "indent" ? (
          <p className="text-xs text-violet-700 bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
            GR Indent — stok cabang tidak berubah. Status item Sales Order akan diperbarui
            otomatis.
          </p>
        ) : (
          <p className="text-xs text-success bg-success/10 border border-success/20 rounded-lg p-3">
            GR Reguler — stok cabang akan bertambah otomatis setelah konfirmasi.
          </p>
        )}

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-center">Sisa Order</TableHead>
                <TableHead className="text-center w-28">Qty Terima</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((item) => {
                const remaining = item.ordered_qty - item.received_qty;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.product_name}</TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {remaining} {item.unit}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={remaining}
                        className="h-8 text-center"
                        value={qties[item.id] ?? 0}
                        onChange={(e) =>
                          setQties((p) => ({
                            ...p,
                            [item.id]: Math.min(
                              remaining,
                              Math.max(0, Number(e.target.value) || 0),
                            ),
                          }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-1.5">
          <Label>Catatan</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            className="bg-orange-600 hover:bg-orange-700"
            disabled={loading}
            onClick={() => void handleSubmit()}
          >
            {loading ? "Menyimpan..." : "Konfirmasi Terima"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useMemo, useState } from "react";
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
import { rupiah } from "@/lib/format";
import { createReturnRequest } from "@/lib/api/returns";
import type { SalesItem } from "@/types/database";
import type { SalesTransactionRecord } from "@/types/sales-transactions";
import { getTransactionForReturn } from "@/lib/api/returns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type ReturnDialogItem = SalesItem & { qty_pending_return?: number };

interface SalesReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: SalesTransactionRecord;
  tenantId: string;
  branchId: string;
  userId: string;
  onCreated?: () => void;
}

export function SalesReturnDialog({
  open,
  onOpenChange,
  transaction,
  tenantId,
  branchId,
  userId,
  onCreated,
}: SalesReturnDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ReturnDialogItem[]>([]);
  const [withinWindow, setWithinWindow] = useState(true);
  const [deadlineLabel, setDeadlineLabel] = useState("");
  const [reasonNotes, setReasonNotes] = useState("");
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void getTransactionForReturn(tenantId, transaction.id).then((res) => {
      setLoading(false);
      if (res.error || !res.data) {
        toast.error(res.error ?? "Gagal memuat data transaksi");
        return;
      }
      setItems(res.data.items);
      setWithinWindow(res.data.withinWindow);
      setDeadlineLabel(res.data.deadlineLabel);
      const initial: Record<string, number> = {};
      for (const item of res.data.items) {
        initial[item.id] = 0;
      }
      setQtyByItem(initial);
    });
  }, [open, tenantId, transaction.id]);

  const returnableItems = useMemo(
    () =>
      items.filter((item) => {
        if (item.is_so_line) return false;
        const returned = item.qty_returned ?? 0;
        const pending = item.qty_pending_return ?? 0;
        return item.qty - returned - pending > 0;
      }),
    [items],
  );

  const requestedTotal = useMemo(() => {
    return returnableItems.reduce((sum, item) => {
      const qty = qtyByItem[item.id] ?? 0;
      if (qty <= 0) return sum;
      const unitPrice = Math.round(item.subtotal / item.qty);
      return sum + unitPrice * qty;
    }, 0);
  }, [returnableItems, qtyByItem]);

  const handleSubmit = async () => {
    const lines = returnableItems
      .filter((item) => (qtyByItem[item.id] ?? 0) > 0)
      .map((item) => ({ salesItemId: item.id, qty: qtyByItem[item.id]! }));

    if (lines.length === 0) {
      toast.error("Pilih minimal 1 barang untuk diretur");
      return;
    }

    setSubmitting(true);
    const res = await createReturnRequest(tenantId, branchId, userId, {
      originalTransactionId: transaction.id,
      lines,
      reasonNotes: reasonNotes.trim() || undefined,
    });
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(`Pengajuan retur ${res.data!.returnNumber} — menunggu QC`);
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Retur Barang — {transaction.transactionNumber}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={withinWindow ? "secondary" : "destructive"}>
                {withinWindow ? "Dalam batas retur" : "Retur lewat batas (H+1)"}
              </Badge>
              <span className="text-muted-foreground text-xs">
                Batas: {deadlineLabel || "—"}
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-center">Tersisa</TableHead>
                  <TableHead className="text-right">Qty Retur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnableItems.map((item) => {
                  const pending = item.qty_pending_return ?? 0;
                  const max = item.qty - (item.qty_returned ?? 0) - pending;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{item.product_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                        {pending > 0 && (
                          <div className="text-[10px] text-amber-600 mt-0.5">
                            {pending} {item.unit} menunggu proses retur
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {max} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={max}
                          className="w-20 ml-auto"
                          value={qtyByItem[item.id] ?? 0}
                          onChange={(e) => {
                            const v = Math.min(max, Math.max(0, Number(e.target.value) || 0));
                            setQtyByItem((prev) => ({ ...prev, [item.id]: v }));
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {returnableItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      Tidak ada barang yang bisa diretur
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="space-y-2">
              <Label htmlFor="return-notes">Catatan (opsional)</Label>
              <Textarea
                id="return-notes"
                value={reasonNotes}
                onChange={(e) => setReasonNotes(e.target.value)}
                placeholder="Alasan retur, kondisi barang, dll."
                rows={2}
              />
            </div>

            <div className="flex justify-between text-sm font-medium border-t pt-3">
              <span>Perkiraan nilai retur</span>
              <span>{rupiah(requestedTotal)}</span>
            </div>

            {!withinWindow && (
              <p className="text-xs text-muted-foreground">
                Retur lewat batas: setelah QC, pilih potong di transaksi baru (hari yang sama) atau
                minta approval manager untuk refund tunai/transfer.
              </p>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={loading || submitting || returnableItems.length === 0}
          >
            {submitting ? "Mengajukan..." : "Ajukan Retur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

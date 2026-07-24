import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Branch } from "@/types/database";
import type { TransferLineDraft } from "@/hooks/useStockTransfer";

interface TransferFormDialogProps {
  open: boolean;
  onClose: () => void;
  branches: Branch[];
  fromBranchId: string;
  toBranchId: string;
  onFromBranchChange: (id: string) => void;
  onToBranchChange: (id: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  draftLines: TransferLineDraft[];
  onUpdateQty: (productId: string, qty: number) => void;
  onSubmit: () => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
  error: string | null;
}

export function TransferFormDialog({
  open,
  onClose,
  branches,
  fromBranchId,
  toBranchId,
  onFromBranchChange,
  onToBranchChange,
  notes,
  onNotesChange,
  draftLines,
  onUpdateQty,
  onSubmit,
  loading,
  error,
}: TransferFormDialogProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const activeLines = draftLines.filter((l) => l.qty > 0);

  const handleSubmit = async () => {
    setLocalError(null);
    const result = await onSubmit();
    if (!result.success) setLocalError(result.error ?? "Gagal membuat transfer");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transfer Baru</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Dari Cabang</Label>
            <Select value={fromBranchId} onValueChange={onFromBranchChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ke Cabang</Label>
            <Select value={toBranchId} onValueChange={onToBranchChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches
                  .filter((b) => b.id !== fromBranchId)
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Catatan</Label>
          <Textarea value={notes} onChange={(e) => onNotesChange(e.target.value)} rows={2} />
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-center">Stok Tersedia</TableHead>
                <TableHead className="text-center w-28">Qty Kirim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftLines.slice(0, 20).map((line) => (
                <TableRow key={line.productId}>
                  <TableCell>
                    <div className="text-sm font-medium">{line.name}</div>
                    <div className="text-xs text-muted-foreground">{line.sku}</div>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {line.availableStock} {line.unit}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={line.availableStock}
                      className="h-8 text-center"
                      value={line.qty || ""}
                      onChange={(e) =>
                        onUpdateQty(
                          line.productId,
                          Math.min(line.availableStock, Math.max(0, Number(e.target.value) || 0)),
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          {activeLines.length} item dipilih · Qty kirim tidak boleh melebihi stok cabang asal
        </p>

        {(error || localError) && (
          <p className="text-sm text-destructive">{error || localError}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            className="bg-cyan-600 hover:bg-cyan-700"
            disabled={loading || activeLines.length === 0}
            onClick={() => void handleSubmit()}
          >
            {loading ? "Menyimpan..." : "Simpan Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

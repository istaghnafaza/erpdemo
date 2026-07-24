import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DateDisplay } from "@/components/ui/date-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MockTransferWithItems } from "@/lib/mock-inventory";
import type { DbTransferStatus } from "@/types/database";

const STATUS_MAP: Record<DbTransferStatus, "draft" | "sent" | "received" | "cancelled"> = {
  draft: "draft",
  sent: "sent",
  received: "received",
  cancelled: "cancelled",
};

interface TransferDetailDialogProps {
  transfer: MockTransferWithItems | null;
  onClose: () => void;
  canReceive: boolean;
  loading: boolean;
  onSend: () => void;
  onReceive: () => void;
  onCancel: () => void;
}

export function TransferDetailDialog({
  transfer,
  onClose,
  canReceive,
  loading,
  onSend,
  onReceive,
  onCancel,
}: TransferDetailDialogProps) {
  if (!transfer) return null;

  return (
    <Dialog open={!!transfer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {transfer.transfer_number}
            <StatusBadge status={STATUS_MAP[transfer.status]} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Dari</div>
            <div className="font-medium">{transfer.from_branch?.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Ke</div>
            <div className="font-medium">{transfer.to_branch?.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Dibuat</div>
            <DateDisplay value={transfer.created_at} withTime />
          </div>
          {transfer.sent_at && (
            <div>
              <div className="text-muted-foreground text-xs">Dikirim</div>
              <DateDisplay value={transfer.sent_at} withTime />
            </div>
          )}
        </div>

        {transfer.notes && (
          <p className="text-sm text-muted-foreground border rounded-lg p-3">{transfer.notes}</p>
        )}

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-center">Kirim</TableHead>
                <TableHead className="text-center">Terima</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{item.product_name}</div>
                    <div className="text-xs text-muted-foreground">{item.sku}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    {item.sent_qty} {item.unit}
                  </TableCell>
                  <TableCell className="text-center">
                    {transfer.status === "received" ? `${item.received_qty} ${item.unit}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {transfer.status === "draft" && (
            <>
              <Button variant="outline" onClick={onCancel} disabled={loading}>
                Batalkan
              </Button>
              <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={onSend} disabled={loading}>
                Kirim Transfer
              </Button>
            </>
          )}
          {transfer.status === "sent" && canReceive && (
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={onReceive} disabled={loading}>
              Konfirmasi Terima
            </Button>
          )}
          {transfer.status === "sent" && !canReceive && (
            <p className="text-xs text-muted-foreground w-full">
              Menunggu konfirmasi penerimaan di cabang tujuan
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DateDisplay } from "@/components/ui/date-display";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { displayPoStatusLabel, poStatusKind, poTypeLabel } from "@/stores/purchasing.store";
import type { MockGrWithItems, MockPoWithItems } from "@/lib/mock-purchasing";

interface GoodsReceiptListProps {
  receipts: MockGrWithItems[];
  pendingPos?: MockPoWithItems[];
  loading: boolean;
  onReceive?: (po: MockPoWithItems) => void;
}

export function GoodsReceiptList({
  receipts,
  pendingPos = [],
  loading,
  onReceive,
}: GoodsReceiptListProps) {
  if (loading) return <LoadingSkeleton variant="table-row" count={4} />;

  const hasRows = pendingPos.length > 0 || receipts.length > 0;

  if (!hasRows) {
    return (
      <EmptyState
        title="Belum ada penerimaan barang"
        description="PO yang siap diterima akan muncul di sini. Catat GR setelah barang tiba dari supplier."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>No. GR</TableHead>
            <TableHead>No. PO</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingPos.map((po) => (
            <TableRow key={`pending-${po.id}`} className="bg-orange-500/5">
              <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
              <TableCell className="font-mono text-xs font-medium">{po.po_number}</TableCell>
              <TableCell>
                <Badge
                  variant={po.type === "indent" ? "default" : "secondary"}
                  className={po.type === "indent" ? "bg-violet-600" : ""}
                >
                  {poTypeLabel(po.type)}
                </Badge>
              </TableCell>
              <TableCell>{po.supplier?.name ?? "—"}</TableCell>
              <TableCell>{po.items.length} item</TableCell>
              <TableCell>
                <StatusBadge
                  status={poStatusKind(po.status)}
                  label={displayPoStatusLabel(po.status, po.type)}
                />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                <DateDisplay value={po.created_at} />
              </TableCell>
              <TableCell className="text-right">
                {onReceive && (
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 h-8"
                    onClick={() => onReceive(po)}
                  >
                    Konfirmasi Terima
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}

          {receipts.map((gr) => (
            <TableRow key={gr.id}>
              <TableCell className="font-mono text-xs font-medium">{gr.gr_number}</TableCell>
              <TableCell className="font-mono text-xs">{gr.po_number ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={gr.po_type === "indent" ? "default" : "secondary"}>
                  {gr.po_type ? poTypeLabel(gr.po_type) : "Reguler"}
                </Badge>
              </TableCell>
              <TableCell>{gr.supplier?.name ?? "—"}</TableCell>
              <TableCell>{gr.items.length} item</TableCell>
              <TableCell>
                <StatusBadge status="received" label="Diterima" />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                <DateDisplay value={gr.received_at} withTime />
              </TableCell>
              <TableCell />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

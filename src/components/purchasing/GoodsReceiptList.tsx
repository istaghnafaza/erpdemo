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
import { poTypeLabel } from "@/stores/purchasing.store";
import type { MockGrWithItems } from "@/lib/mock-purchasing";

interface GoodsReceiptListProps {
  receipts: MockGrWithItems[];
  loading: boolean;
}

export function GoodsReceiptList({ receipts, loading }: GoodsReceiptListProps) {
  if (loading) return <LoadingSkeleton variant="table-row" count={4} />;

  if (receipts.length === 0) {
    return (
      <EmptyState
        title="Belum ada penerimaan barang"
        description="Catat GR dari PO yang sudah dikirim ke supplier."
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
            <TableHead>Tanggal Terima</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
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
              <TableCell className="text-muted-foreground text-sm">
                <DateDisplay value={gr.received_at} withTime />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

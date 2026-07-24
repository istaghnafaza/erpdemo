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
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import type { MockTransferWithItems } from "@/lib/mock-inventory";
import type { DbTransferStatus } from "@/types/database";

const STATUS_MAP: Record<DbTransferStatus, "draft" | "sent" | "received" | "cancelled"> = {
  draft: "draft",
  sent: "sent",
  received: "received",
  cancelled: "cancelled",
};

interface TransferListProps {
  transfers: MockTransferWithItems[];
  loading: boolean;
  onSelect: (transfer: MockTransferWithItems) => void;
}

export function TransferList({ transfers, loading, onSelect }: TransferListProps) {
  if (loading) return <LoadingSkeleton variant="table-row" count={5} />;

  if (transfers.length === 0) {
    return (
      <EmptyState
        title="Belum ada transfer"
        description="Buat transfer baru untuk memindahkan stok antar cabang."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>No. Transfer</TableHead>
            <TableHead>Dari</TableHead>
            <TableHead>Ke</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tanggal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transfers.map((tf) => (
            <TableRow
              key={tf.id}
              className="cursor-pointer hover:bg-muted/30"
              onClick={() => onSelect(tf)}
            >
              <TableCell className="font-mono text-xs font-medium">{tf.transfer_number}</TableCell>
              <TableCell>{tf.from_branch?.name ?? "—"}</TableCell>
              <TableCell>{tf.to_branch?.name ?? "—"}</TableCell>
              <TableCell>{tf.items.length} item</TableCell>
              <TableCell>
                <StatusBadge status={STATUS_MAP[tf.status]} />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                <DateDisplay value={tf.created_at} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

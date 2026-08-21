import { StatusBadge } from "@/components/ui/status-badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
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
import { poStatusKind, displayPoStatusLabel, poTypeLabel, poReadyForGoodsReceipt } from "@/stores/purchasing.store";
import type { MockPoWithItems } from "@/lib/mock-purchasing";

interface PurchaseOrderListProps {
  orders: MockPoWithItems[];
  loading: boolean;
  onSelect: (po: MockPoWithItems) => void;
}

export function PurchaseOrderList({ orders, loading, onSelect }: PurchaseOrderListProps) {
  if (loading) return <LoadingSkeleton variant="table-row" count={5} />;

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Belum ada Purchase Order"
        description="Buat PO reguler untuk restock atau PO indent dari Sales Order. Data demo tersedia di Cabang Sudirman."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>No. PO</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Ref. SO</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tanggal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((po) => (
            <TableRow
              key={po.id}
              className="cursor-pointer hover:bg-muted/30"
              onClick={() => onSelect(po)}
            >
              <TableCell className="font-mono text-xs font-medium">{po.po_number}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge
                    variant={po.type === "indent" ? "default" : "secondary"}
                    className={po.type === "indent" ? "bg-violet-600" : ""}
                  >
                    {poTypeLabel(po.type)}
                  </Badge>
                  {po.ownership_mode === "consignment" ? (
                    <Badge variant="outline" className="text-[10px]">
                      Konsinyasi
                    </Badge>
                  ) : null}
                  {po.pay_trigger === "on_receipt_cash" ? (
                    <Badge variant="outline" className="text-[10px]">
                      COD
                    </Badge>
                  ) : po.pay_trigger === "on_receipt_credit" ? (
                    <Badge variant="outline" className="text-[10px]">
                      Tempo
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{po.supplier?.name ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {po.sales_order_number ?? "—"}
              </TableCell>
              <TableCell className="text-right font-medium">
                <CurrencyDisplay value={po.grand_total} />
              </TableCell>
              <TableCell>
                <StatusBadge
                  status={poStatusKind(po.status)}
                  label={displayPoStatusLabel(po.status, po.type)}
                />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                <DateDisplay value={po.created_at} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

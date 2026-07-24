import { StatusBadge } from "@/components/ui/status-badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { DateDisplay } from "@/components/ui/date-display";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { soStatusKind, soStatusLabel } from "@/stores/sales-orders.store";
import type { MockSalesOrderWithDetails } from "@/lib/mock-sales-orders";

const PAYMENT_KIND = {
  unpaid: "unpaid",
  partial: "partial",
  paid: "paid",
} as const;

interface SalesOrderListProps {
  orders: MockSalesOrderWithDetails[];
  loading: boolean;
  onSelect: (order: MockSalesOrderWithDetails) => void;
}

export function SalesOrderList({ orders, loading, onSelect }: SalesOrderListProps) {
  if (loading) return <LoadingSkeleton variant="table-row" count={5} />;

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Belum ada Sales Order"
        description="SO dibuat otomatis saat checkout POS — tandai barang dengan ikon paket di keranjang. Data demo tersedia di Cabang Sudirman."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>No. SO</TableHead>
            <TableHead>Pelanggan</TableHead>
            <TableHead>Ref. POS</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status SO</TableHead>
            <TableHead>Pembayaran</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Invoice</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow
              key={o.id}
              className="cursor-pointer hover:bg-muted/30"
              onClick={() => onSelect(o)}
            >
              <TableCell className="font-mono text-xs font-medium">{o.so_number}</TableCell>
              <TableCell>
                <div className="font-medium">{o.customer_name}</div>
                {o.delivery_address && (
                  <div className="text-xs text-muted-foreground truncate max-w-48">
                    {o.delivery_address}
                  </div>
                )}
              </TableCell>
              <TableCell className="font-mono text-[11px] text-muted-foreground">
                {o.pos_transaction_number ?? (o.source === "manual" ? "Manual" : "—")}
              </TableCell>
              <TableCell className="text-right font-medium">
                <CurrencyDisplay value={o.grand_total} />
              </TableCell>
              <TableCell>
                <StatusBadge
                  status={soStatusKind(o.status)}
                  label={soStatusLabel(o.status)}
                />
              </TableCell>
              <TableCell>
                <StatusBadge status={PAYMENT_KIND[o.payment_status]} />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                <DateDisplay value={o.created_at} />
              </TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {o.ar_invoice_number ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

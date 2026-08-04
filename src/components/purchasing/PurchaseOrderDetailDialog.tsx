import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { DateDisplay } from "@/components/ui/date-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { poStatusKind, displayPoStatusLabel, poTypeLabel, poReadyForGoodsReceipt } from "@/stores/purchasing.store";
import { useAuthStore } from "@/stores/auth.store";
import type { MockPoWithItems } from "@/lib/mock-purchasing";

interface PurchaseOrderDetailDialogProps {
  po: MockPoWithItems | null;
  onClose: () => void;
  loading: boolean;
  onSend: () => void;
  onConfirmSupplier?: () => void;
  onCancel: () => void;
  onReceive?: () => void;
}

export function PurchaseOrderDetailDialog({
  po,
  onClose,
  loading,
  onSend,
  onConfirmSupplier,
  onCancel,
  onReceive,
}: PurchaseOrderDetailDialogProps) {
  const tenantSlug = useAuthStore((s) => s.currentTenant?.slug) ?? "";
  if (!po) return null;

  const canReceive = poReadyForGoodsReceipt(po.status, po.type);
  const awaitingSupplier = po.type === "indent" && po.status === "awaiting_supplier";

  return (
    <Dialog open={!!po} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {po.po_number}
            <Badge className={po.type === "indent" ? "bg-violet-600" : ""}>
              {poTypeLabel(po.type)}
            </Badge>
            <StatusBadge
              status={poStatusKind(po.status)}
              label={displayPoStatusLabel(po.status, po.type)}
            />
          </DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Supplier</div>
            <div className="font-medium">{po.supplier?.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Tanggal</div>
            <DateDisplay value={po.created_at} withTime />
          </div>
          {po.sales_order_number && (
            <div>
              <div className="text-xs text-muted-foreground">Ref. Sales Order</div>
              <div className="font-medium">{po.sales_order_number}</div>
            </div>
          )}
          {po.delivery_address && (
            <div className="sm:col-span-2">
              <div className="text-xs text-muted-foreground">
                {po.type === "indent" ? "Alamat Kirim Klien" : "Alamat Pengiriman"}
              </div>
              <div>{po.delivery_address}</div>
            </div>
          )}
        </div>

        {awaitingSupplier && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            PO indent menunggu konfirmasi supplier. Setelah supplier mengonfirmasi ketersediaan,
            klik &quot;Supplier Konfirmasi&quot; untuk mengaktifkan penerimaan barang.
          </p>
        )}

        {po.type === "indent" && !awaitingSupplier && (
          <p className="text-xs text-violet-700 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
            PO Indent — penerimaan barang tidak menambah stok cabang. Barang dikirim langsung ke
            alamat pelanggan SO.
          </p>
        )}

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-center">Order</TableHead>
                <TableHead className="text-center">Terima</TableHead>
                <TableHead className="text-right">Harga</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{item.product_name}</div>
                    <div className="text-xs text-muted-foreground">{item.sku}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    {item.ordered_qty} {item.unit}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.received_qty} {item.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={item.purchase_price} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center rounded-lg bg-muted/40 p-3">
          <span className="text-sm text-muted-foreground">Grand Total</span>
          <span className="text-lg font-bold">
            <CurrencyDisplay value={po.grand_total} />
          </span>
        </div>

        {po.notes && (
          <p className="text-sm text-muted-foreground border rounded-lg p-3">{po.notes}</p>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {po.status === "draft" && (
            <>
              <Button variant="outline" onClick={onCancel} disabled={loading}>
                Batalkan
              </Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700"
                onClick={onSend}
                disabled={loading}
              >
                Kirim ke Supplier
              </Button>
            </>
          )}
          {awaitingSupplier && onConfirmSupplier && (
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={onConfirmSupplier} disabled={loading}>
              Supplier Konfirmasi
            </Button>
          )}
          {canReceive && onReceive && (
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={onReceive}>
              Catat Penerimaan (GR)
            </Button>
          )}
          {po.sales_order_id && tenantSlug && (
            <Link
              to="/$tenantSlug/sales-orders"
              params={{ tenantSlug }}
              className="text-xs text-primary underline ml-auto"
            >
              Lihat Sales Order →
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

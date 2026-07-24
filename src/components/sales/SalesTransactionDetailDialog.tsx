import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { paymentMethodLabel, TX_STATUS_LABELS, orderFulfillmentLabel } from "@/lib/sales-transaction-utils";
import { rupiah, tanggal } from "@/lib/format";
import type { SalesTransactionRecord } from "@/types/sales-transactions";

interface SalesTransactionDetailDialogProps {
  transaction: SalesTransactionRecord | null;
  onClose: () => void;
}

export function SalesTransactionDetailDialog({
  transaction,
  onClose,
}: SalesTransactionDetailDialogProps) {
  if (!transaction) return null;

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{transaction.transactionNumber}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <div className="text-muted-foreground text-xs">Tanggal</div>
            <div>{tanggal(transaction.createdAt, { withTime: true })}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Cabang</div>
            <div>{transaction.branchName}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Kasir</div>
            <div>{transaction.cashierName}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Metode Bayar</div>
            <div>{paymentMethodLabel(transaction.paymentMethod)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Keterangan Order</div>
            <div>{orderFulfillmentLabel(transaction.orderFulfillmentType ?? "cod")}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Customer</div>
            <div>{transaction.customerName ?? "—"}</div>
          </div>
          {transaction.deliveryAddress && (
            <div className="col-span-2">
              <div className="text-muted-foreground text-xs">Lokasi pengiriman</div>
              {transaction.deliverySiteLabel && (
                <div className="text-xs font-medium">{transaction.deliverySiteLabel}</div>
              )}
              <div className="text-sm">{transaction.deliveryAddress}</div>
            </div>
          )}
          <div>
            <div className="text-muted-foreground text-xs">Status</div>
            <Badge
              variant="secondary"
              className={
                transaction.status === "voided"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-success/15 text-success"
              }
            >
              {TX_STATUS_LABELS[transaction.status]}
            </Badge>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>SKU</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Harga</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transaction.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                <TableCell>
                  {item.productName}
                  {item.isSoLine && (
                    <Badge variant="outline" className="ml-2 text-[10px] text-indigo-600 border-indigo-300">
                      SO
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {item.qty} {item.unit}
                </TableCell>
                <TableCell className="text-right">
                  <CurrencyDisplay value={item.sellingPrice} />
                </TableCell>
                <TableCell className="text-right font-medium">
                  <CurrencyDisplay value={item.subtotal} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 space-y-1 text-sm border-t pt-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{rupiah(transaction.subtotal)}</span>
          </div>
          {transaction.discountAmount > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Diskon</span>
              <span>−{rupiah(transaction.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base pt-1">
            <span>Grand Total</span>
            <span>{rupiah(transaction.grandTotal)}</span>
          </div>
          {transaction.isOffline && (
            <p className="text-xs text-warning-foreground pt-2">Transaksi dicatat saat mode offline</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { SalesReceiptPrintDialog } from "@/components/sales/SalesReceiptPrintDialog";
import { HandoverPrintDialog } from "@/components/print/HandoverPrintDialog";
import { SalesReturnDialog } from "@/components/sales/SalesReturnDialog";
import { buildReceiptFromSalesTransaction } from "@/lib/build-receipt-data";
import { buildHandoverDocFromPos, buildHandoverLinesFromSaleItems } from "@/lib/handover-doc";
import { paymentMethodLabel, RETURN_STATUS_LABELS, TX_STATUS_LABELS, orderFulfillmentLabel } from "@/lib/sales-transaction-utils";
import { canVoidSale } from "@/lib/rbac";
import { voidTransaction } from "@/lib/api/transactions";
import { rupiah, tanggal } from "@/lib/format";
import { Printer, RotateCcw, Ban, Package, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { findSalesOrderByPosTransaction } from "@/lib/api/sales-orders";
import { computeItemMargin, computeTransactionMargin } from "@/lib/sales-margin";
import { useSalesOrdersStore } from "@/stores/sales-orders.store";
import { isMockTenantId } from "@/lib/mock-session";
import type { SalesTransactionRecord } from "@/types/sales-transactions";
import type { UserRole } from "@/types/app";

interface SalesTransactionDetailDialogProps {
  transaction: SalesTransactionRecord | null;
  storeName: string;
  branchAddress: string | null;
  branchPhone: string | null;
  tenantId: string;
  branchId: string;
  userId: string;
  userRole: UserRole | string | undefined;
  onClose: () => void;
  onUpdated?: () => void;
}

export function SalesTransactionDetailDialog({
  transaction,
  storeName,
  branchAddress,
  branchPhone,
  tenantId,
  branchId,
  userId,
  userRole,
  onClose,
  onUpdated,
}: SalesTransactionDetailDialogProps) {
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(true);
  const [returnOpen, setReturnOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [linkedSoId, setLinkedSoId] = useState<string | null>(null);
  const tenantSlug = useAuthStore((s) => s.currentTenant?.slug) ?? "";

  const hasSoLines = useMemo(
    () => transaction?.items.some((i) => i.isSoLine) ?? false,
    [transaction?.items],
  );

  useEffect(() => {
    if (!transaction || !hasSoLines) {
      setLinkedSoId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      if (isMockTenantId(tenantId)) {
        const mock = useSalesOrdersStore
          .getState()
          .mockOrders.find(
            (o) =>
              o.branch_id === branchId &&
              o.pos_transaction_number === transaction.transactionNumber,
          );
        if (!cancelled) setLinkedSoId(mock?.id ?? null);
        return;
      }
      const result = await findSalesOrderByPosTransaction(
        tenantId,
        branchId,
        transaction.transactionNumber,
      );
      if (!cancelled) setLinkedSoId(result.data?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [transaction?.id, transaction?.transactionNumber, tenantId, branchId, hasSoLines]);

  useEffect(() => {
    if (transaction) {
      setDetailOpen(true);
      setReturnOpen(false);
      setReceiptOpen(false);
      setHandoverOpen(false);
    }
  }, [transaction?.id]);

  const receiptData = useMemo(
    () =>
      transaction
        ? buildReceiptFromSalesTransaction(transaction, {
            branchAddress,
            branchPhone,
            storeName,
          })
        : null,
    [transaction, branchAddress, branchPhone, storeName],
  );

  const handoverDoc = useMemo(
    () =>
      transaction
        ? buildHandoverDocFromPos({
            storeName,
            branchName: transaction.branchName,
            branchAddress,
            branchPhone,
            transactionNumber: transaction.transactionNumber,
            createdAt: transaction.createdAt,
            cashierName: transaction.cashierName,
            customerName: transaction.customerName,
            deliverySiteLabel: transaction.deliverySiteLabel,
            deliveryAddress: transaction.deliveryAddress,
            orderFulfillmentType: transaction.orderFulfillmentType,
            handoverLines: buildHandoverLinesFromSaleItems(transaction.items),
          })
        : null,
    [transaction, storeName, branchAddress, branchPhone],
  );

  if (!transaction) return null;

  const txMargin = computeTransactionMargin(transaction);

  const canReturn =
    transaction.status === "completed" &&
    (transaction.returnStatus ?? "none") !== "full";
  const canVoid =
    canVoidSale(userRole) &&
    transaction.status === "completed" &&
    (transaction.returnStatus ?? "none") === "none";

  const handleVoid = async () => {
    if (!window.confirm(`Void transaksi ${transaction.transactionNumber}?`)) return;
    setVoiding(true);
    const res = await voidTransaction(tenantId, transaction.id, userId);
    setVoiding(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Transaksi di-void");
    onUpdated?.();
    onClose();
  };

  return (
    <>
      <Dialog
        open={Boolean(transaction) && detailOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
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
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                <Badge
                  variant="secondary"
                  className={
                    transaction.status === "voided"
                      ? "bg-destructive/15 text-destructive"
                      : transaction.status === "returned"
                        ? "bg-warning/15 text-warning-foreground"
                        : "bg-success/15 text-success"
                  }
                >
                  {TX_STATUS_LABELS[transaction.status]}
                </Badge>
                {(transaction.returnStatus ?? "none") !== "none" &&
                  transaction.status !== "returned" && (
                    <Badge variant="outline" className="border-amber-300 text-amber-700">
                      {RETURN_STATUS_LABELS[transaction.returnStatus ?? "partial"]}
                    </Badge>
                  )}
              </div>
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
                <TableHead className="text-right">Keuntungan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transaction.items.map((item) => {
                const lineMargin = computeItemMargin({
                  qty: item.qty,
                  qtyReturned: item.qtyReturned,
                  subtotal: item.subtotal,
                  purchasePrice: item.purchasePrice,
                  isSoLine: item.isSoLine,
                });
                return (
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
                  <TableCell className="text-right text-sm">
                    <CurrencyDisplay value={lineMargin} />
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>

          <div className="mt-4 space-y-1 text-sm border-t pt-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{rupiah(transaction.subtotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Keuntungan (stok + SO)</span>
              <span>{rupiah(txMargin)}</span>
            </div>
            {transaction.discountAmount > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Diskon keranjang</span>
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

          <DialogFooter className="gap-2 sm:justify-between flex-wrap">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setReceiptOpen(true)}>
                <Printer className="h-4 w-4 mr-1.5" /> Cetak Struk / Invoice
              </Button>
              <Button variant="outline" onClick={() => setHandoverOpen(true)}>
                <ClipboardList className="h-4 w-4 mr-1.5" /> Cetak Surat Jalan
              </Button>
              {hasSoLines && linkedSoId && tenantSlug && (
                <Button variant="outline" asChild>
                  <Link
                    to="/$tenantSlug/sales-orders"
                    params={{ tenantSlug }}
                    search={{ openSo: linkedSoId }}
                  >
                    <Package className="h-4 w-4 mr-1.5" /> Buka Sales Order
                  </Link>
                </Button>
              )}
              {canReturn && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetailOpen(false);
                    setReturnOpen(true);
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Retur Barang
                </Button>
              )}
              {canVoid && (
                <Button variant="destructive" onClick={() => void handleVoid()} disabled={voiding}>
                  <Ban className="h-4 w-4 mr-1.5" /> Void
                </Button>
              )}
            </div>
            <Button variant="secondary" onClick={onClose}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SalesReceiptPrintDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        receipt={receiptData}
      />

      <HandoverPrintDialog
        open={handoverOpen}
        onOpenChange={setHandoverOpen}
        doc={handoverDoc}
      />

      {canReturn && transaction && (
        <SalesReturnDialog
          open={returnOpen}
          onOpenChange={(open) => {
            setReturnOpen(open);
            if (!open) onClose();
          }}
          transaction={transaction}
          tenantId={tenantId}
          branchId={transaction.branchId}
          userId={userId}
          onCreated={() => {
            onUpdated?.();
            setReturnOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

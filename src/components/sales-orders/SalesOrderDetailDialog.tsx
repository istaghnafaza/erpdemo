import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, Package, Pencil, Truck } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { DateDisplay } from "@/components/ui/date-display";
import { Badge } from "@/components/ui/badge";
import { soStatusKind, soStatusLabel, canEditSalesOrder } from "@/stores/sales-orders.store";
import { rupiah } from "@/lib/format";
import {
  prefillFulfillmentDraft,
  soItemRemaining,
  soOrderNeedsFulfillment,
  soOrderRemainingQty,
  suggestStockFulfillQty,
} from "@/lib/so-fulfillment-utils";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { indentPoStatusLabel } from "@/stores/purchasing.store";
import type { FulfillItemResult } from "@/lib/api/sales-orders";
import type { MockSalesOrderWithDetails } from "@/lib/mock-sales-orders";

interface SalesOrderDetailDialogProps {
  order: MockSalesOrderWithDetails | null;
  onClose: () => void;
  suppliers: { id: string; name: string; phone?: string | null }[];
  getSuppliersForProduct: (productId: string | null) => { id: string; name: string; phone?: string | null }[];
  getDefaultSupplierId: (productId: string | null) => string | undefined;
  getProductStock: (productId: string) => number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onFulfill: (
    soItemId: string,
    stockQty: number,
    indentQty: number,
    supplierId?: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    indentPo?: FulfillItemResult["indentPo"];
    waOpened?: boolean;
  }>;
  onConvertInvoice: () => void;
  onEdit: () => void;
}

export function SalesOrderDetailDialog({
  order,
  onClose,
  suppliers,
  getSuppliersForProduct,
  getDefaultSupplierId,
  getProductStock,
  loading,
  onConfirm,
  onCancel,
  onFulfill,
  onConvertInvoice,
  onEdit,
}: SalesOrderDetailDialogProps) {
  const tenantSlug = useAuthStore((s) => s.currentTenant?.slug) ?? "";
  const [activeTab, setActiveTab] = useState("fulfillment");
  const [stockQtys, setStockQtys] = useState<Record<string, number>>({});
  const [indentQtys, setIndentQtys] = useState<Record<string, number>>({});
  const [supplierIds, setSupplierIds] = useState<Record<string, string>>({});

  useEffect(() => {
    if (order) setActiveTab("fulfillment");
  }, [order?.id]);

  useEffect(() => {
    if (!order) return;
    const draft = prefillFulfillmentDraft(order, getProductStock, getDefaultSupplierId);
    setStockQtys(draft.stockQtys);
    setIndentQtys(draft.indentQtys);
    setSupplierIds(draft.supplierIds);
  }, [order?.id, getProductStock, getDefaultSupplierId]);

  if (!order) return null;

  const canFulfill =
    order.status === "confirmed" ||
    order.status === "partial_delivered" ||
    order.status === "completed";

  const showEdit = canEditSalesOrder(order);
  const hasReceivableBalance = order.remaining_payment > 0;
  const canConvertInvoice =
    order.status === "completed" &&
    !order.ar_invoice_number &&
    hasReceivableBalance &&
    Boolean(order.customer_id);

  const handleFulfillItem = async (itemId: string, productId: string | null) => {
    const stock = stockQtys[itemId] ?? 0;
    const indent = indentQtys[itemId] ?? 0;
    if (stock + indent <= 0) {
      toast.error("Isi qty dari stok atau indent minimal 1");
      return;
    }
    const itemSuppliers = getSuppliersForProduct(productId);
    const result = await onFulfill(
      itemId,
      stock,
      indent,
      supplierIds[itemId] ?? itemSuppliers[0]?.id,
    );
    if (!result.success) {
      toast.error(result.error ?? "Gagal fulfillment");
      return;
    }
    setStockQtys((p) => ({ ...p, [itemId]: 0 }));
    setIndentQtys((p) => ({ ...p, [itemId]: 0 }));
    if (result.indentPo) {
      toast.success(
        result.waOpened
          ? `PO ${result.indentPo.poNumber} dibuat — WhatsApp order terbuka`
          : `PO ${result.indentPo.poNumber} dibuat — tambahkan nomor WA supplier untuk kirim order`,
      );
      setActiveTab("indent");
    } else {
      toast.success("Fulfillment stok diproses");
    }
    void productId;
  };

  const applyStockMax = (item: (typeof order.items)[number]) => {
    const avail = item.product_id ? getProductStock(item.product_id) : 0;
    setStockQtys((p) => ({ ...p, [item.id]: suggestStockFulfillQty(item, avail) }));
    setIndentQtys((p) => ({ ...p, [item.id]: 0 }));
  };

  const applyIndentAll = (item: (typeof order.items)[number]) => {
    const remaining = soItemRemaining(item);
    setStockQtys((p) => ({ ...p, [item.id]: 0 }));
    setIndentQtys((p) => ({ ...p, [item.id]: remaining }));
  };

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {order.so_number}
            <StatusBadge status={soStatusKind(order.status)} label={soStatusLabel(order.status)} />
            <StatusBadge status={order.payment_status} />
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">
              Info
            </TabsTrigger>
            <TabsTrigger value="fulfillment" className="flex-1">
              Fulfillment
            </TabsTrigger>
            <TabsTrigger value="indent" className="flex-1">
              PO Indent
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Info label="Pelanggan" value={order.customer_name} />
              <Info
                label="Estimasi Kirim"
                value={
                  order.estimated_delivery_date ? (
                    <DateDisplay value={order.estimated_delivery_date} />
                  ) : (
                    "—"
                  )
                }
              />
              <Info label="Alamat" value={order.delivery_address ?? "—"} />
              <Info
                label="Sumber"
                value={
                  order.source === "pos" && order.pos_transaction_number ? (
                    <span>
                      Checkout POS · {order.pos_transaction_number}
                      {tenantSlug && (
                        <>
                          {" · "}
                          <Link
                            to="/$tenantSlug/sales/transactions"
                            params={{ tenantSlug }}
                            className="text-primary underline text-xs"
                          >
                            Histori penjualan
                          </Link>
                        </>
                      )}
                    </span>
                  ) : (
                    "Manual"
                  )
                }
              />
              <Info label="Dibuat" value={<DateDisplay value={order.created_at} withTime />} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Subtotal" amount={order.subtotal} />
              <Stat label="Down Payment" amount={order.down_payment} />
              <Stat label="Sisa Bayar" amount={order.remaining_payment} accent />
            </div>
            {order.notes && (
              <p className="text-sm text-muted-foreground border rounded-lg p-3">{order.notes}</p>
            )}
            {order.ar_invoice_number && (
              <div className="rounded-lg bg-success/10 border border-success/30 p-3 flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-success" />
                Invoice: <strong>{order.ar_invoice_number}</strong>
                {tenantSlug && (
                  <Link
                    to="/$tenantSlug/receivables"
                    params={{ tenantSlug }}
                    className="ml-auto text-xs text-primary underline"
                  >
                    Lihat Piutang →
                  </Link>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="fulfillment" className="mt-4 space-y-4">
            {soOrderNeedsFulfillment(order) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                <strong>{soOrderRemainingQty(order)} unit</strong> menunggu fulfillment — default
                indent ke supplier. Stok cabang opsional jika tersedia.
              </div>
            )}
            {order.items.map((item) => {
              const remaining = soItemRemaining(item);
              const available = item.product_id ? getProductStock(item.product_id) : 0;
              const itemSuppliers = getSuppliersForProduct(item.product_id);
              const isDone = item.status === "fulfilled";
              const progressPct = item.qty > 0 ? Math.round((item.delivered_qty / item.qty) * 100) : 0;

              return (
                <div key={item.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.sku} · Order {item.qty} {item.unit} · Terkirim {item.delivered_qty}
                        {remaining > 0 && (
                          <span className="text-amber-700"> · Sisa {remaining}</span>
                        )}
                      </div>
                      {item.product_id && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Badge
                            variant={available > 0 ? "secondary" : "outline"}
                            className={
                              available > 0
                                ? "text-xs font-normal gap-1"
                                : "text-xs font-normal gap-1 text-muted-foreground"
                            }
                          >
                            <Package className="h-3 w-3" />
                            Stok cabang: {available} {item.unit}
                          </Badge>
                          {available === 0 && remaining > 0 && !isDone && (
                            <span className="text-[11px] text-muted-foreground">
                              Tidak ada stok — gunakan indent
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-1.5 h-1.5 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                    <StatusBadge
                      status={
                        item.status === "fulfilled"
                          ? "completed"
                          : item.status === "partial"
                            ? "partial"
                            : "pending"
                      }
                      label={
                        item.status === "fulfilled"
                          ? "Selesai"
                          : item.status === "partial"
                            ? "Sebagian"
                            : "Menunggu"
                      }
                    />
                  </div>

                  {(item.fulfillments ?? []).length > 0 && (
                    <div className="space-y-1">
                      {(item.fulfillments ?? []).map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          {f.source === "stock" ? (
                            <Package className="h-3.5 w-3.5" />
                          ) : (
                            <Truck className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {f.source === "stock" ? "Stok" : "Indent"} · {f.qty} {item.unit} ·{" "}
                            {f.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isDone && canFulfill && remaining > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() => applyIndentAll(item)}
                        >
                          Indent sisa ({remaining})
                        </Button>
                        {available > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => applyStockMax(item)}
                          >
                            Isi dari stok ({Math.min(remaining, available)})
                          </Button>
                        )}
                      </div>
                    <div className="grid sm:grid-cols-4 gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Indent ke supplier (max {remaining})</Label>
                        <Input
                          type="number"
                          min={0}
                          max={remaining}
                          className="h-8"
                          value={indentQtys[item.id] ?? ""}
                          placeholder="0"
                          onChange={(e) =>
                            setIndentQtys((p) => ({
                              ...p,
                              [item.id]: Math.min(
                                remaining,
                                Math.max(0, Number(e.target.value) || 0),
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Dari stok
                          {available > 0
                            ? ` (max ${Math.min(remaining, available)})`
                            : " (kosong)"}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={Math.min(remaining, available)}
                          className="h-8"
                          value={stockQtys[item.id] ?? ""}
                          placeholder="0"
                          disabled={available <= 0}
                          onChange={(e) =>
                            setStockQtys((p) => ({
                              ...p,
                              [item.id]: Math.min(
                                remaining,
                                available,
                                Math.max(0, Number(e.target.value) || 0),
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Supplier Indent</Label>
                        {itemSuppliers.length === 0 ? (
                          <p className="text-[11px] text-amber-700">
                            Belum ada supplier untuk produk ini —{" "}
                            {tenantSlug && (
                              <Link
                                to="/$tenantSlug/purchasing/suppliers"
                                params={{ tenantSlug }}
                                className="underline"
                              >
                                atur di modul Supplier
                              </Link>
                            )}
                          </p>
                        ) : (
                          <Select
                            value={
                              supplierIds[item.id] ??
                              itemSuppliers[0]?.id ??
                              ""
                            }
                            onValueChange={(v) =>
                              setSupplierIds((p) => ({ ...p, [item.id]: v }))
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {itemSuppliers.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700"
                        disabled={loading || (indentQtys[item.id] ?? 0) > 0 && itemSuppliers.length === 0}
                        onClick={() => void handleFulfillItem(item.id, item.product_id)}
                      >
                        Proses
                      </Button>
                    </div>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="indent" className="mt-4">
            {(order.indent_pos ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Belum ada PO Indent — otomatis dibuat saat fulfillment indent diproses.
              </p>
            ) : (
              <div className="space-y-3">
                {(order.indent_pos ?? []).map((po) => {
                  const totalQty = po.lines.reduce((s, l) => s + l.qty, 0);
                  return (
                    <div key={po.id} className="rounded-lg border p-3 text-sm space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-mono font-medium">{po.po_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {po.supplier_name} · {po.lines.length} item · {totalQty} unit total
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {po.po_status
                              ? indentPoStatusLabel(po.po_status)
                              : po.status === "sent"
                                ? "Menunggu jawaban supplier"
                                : "Draft"}
                          </Badge>
                          {tenantSlug && (
                            <Link
                              to="/$tenantSlug/purchasing/purchase-orders"
                              params={{ tenantSlug }}
                              className="text-xs text-primary underline"
                            >
                              Buka PO →
                            </Link>
                          )}
                        </div>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-1 border-t pt-2">
                        {po.lines.map((line) => {
                          const item = order.items.find((i) => i.id === line.so_item_id);
                          return (
                            <li key={line.so_item_id}>
                              {item?.product_name ?? "Item"} · {line.qty} {item?.unit ?? "unit"}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-wrap gap-2">
          {showEdit && (
            <Button variant="outline" onClick={onEdit} disabled={loading} className="gap-1.5">
              <Pencil className="h-4 w-4" />
              Edit SO
            </Button>
          )}
          {order.status === "draft" && (
            <>
              <Button variant="outline" onClick={onCancel} disabled={loading}>
                Batalkan
              </Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={onConfirm}
                disabled={loading}
              >
                Konfirmasi SO
              </Button>
            </>
          )}
          {canConvertInvoice && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={onConvertInvoice}
              disabled={loading}
            >
              Konversi ke Invoice (AR)
            </Button>
          )}
          {order.status === "completed" &&
            !order.ar_invoice_number &&
            !canConvertInvoice &&
            !hasReceivableBalance && (
              <p className="text-xs text-muted-foreground w-full sm:w-auto sm:ml-auto">
                Pembayaran lunas — tidak perlu invoice piutang.
              </p>
            )}
          {order.status === "completed" &&
            !order.ar_invoice_number &&
            hasReceivableBalance &&
            !order.customer_id && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-full sm:flex-1">
                Sisa bayar {rupiah(order.remaining_payment)} — pilih pelanggan terdaftar (Edit SO)
                sebelum buat invoice piutang.
              </p>
            )}
          {(order.status === "confirmed" || order.status === "partial_delivered") && (
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Batalkan SO
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}

function Stat({
  label,
  amount,
  accent,
}: {
  label: string;
  amount: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="text-[11px] text-muted-foreground uppercase">{label}</div>
      <div className={`text-sm font-bold mt-1 ${accent ? "text-primary" : ""}`}>
        <CurrencyDisplay value={amount} />
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { hppDiffers, weightedAvgHpp } from "@/lib/po-costing";
import type { Supplier, DbPoType, DbPoOwnership, DbPoPayTrigger } from "@/types/database";
import type { IndentSoItemOption, PoProductOption } from "@/hooks/usePurchaseOrders";

interface LineDraft {
  key: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  unit: string;
  ordered_qty: number;
  purchase_price: number;
  old_hpp: number;
  selling_price: number;
  stock: number;
}

function formatIdrInput(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return Math.round(n).toLocaleString("id-ID");
}

function parseIdrInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits);
}

interface PurchaseOrderFormDialogProps {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  products: PoProductOption[];
  indentSoItemOptions: IndentSoItemOption[];
  /** Alamat cabang aktif — auto-isi & kunci untuk PO reguler */
  branchAddress?: string | null;
  loading: boolean;
  onSubmit: (data: {
    type: DbPoType;
    ownership_mode: DbPoOwnership;
    pay_trigger: DbPoPayTrigger;
    discount_amount: number;
    rebate_after_qty: number | null;
    rebate_per_unit: number;
    supplier_id: string;
    sales_order_id: string | null;
    sales_order_number?: string | null;
    so_item_id?: string | null;
    delivery_address: string | null;
    expected_date: string | null;
    notes: string | null;
    items: LineDraft[];
  }) => Promise<{ success: boolean; error?: string }>;
}

export function PurchaseOrderFormDialog({
  open,
  onClose,
  suppliers,
  products,
  indentSoItemOptions,
  branchAddress,
  loading,
  onSubmit,
}: PurchaseOrderFormDialogProps) {
  const [poType, setPoType] = useState<DbPoType>("regular");
  const [ownershipMode, setOwnershipMode] = useState<DbPoOwnership>("owned");
  const [payTrigger, setPayTrigger] = useState<DbPoPayTrigger>("on_receipt_credit");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [rebateAfterQty, setRebateAfterQty] = useState("");
  const [rebatePerUnit, setRebatePerUnit] = useState(0);
  const [supplierId, setSupplierId] = useState("");
  const [soItemId, setSoItemId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedSoItem = indentSoItemOptions.find((o) => o.soItemId === soItemId);
  const isIndent = poType === "indent";
  const isRegular = poType === "regular";

  useEffect(() => {
    if (!open) return;
    setPoType("regular");
    setOwnershipMode("owned");
    setPayTrigger("on_receipt_credit");
    setDiscountAmount(0);
    setRebateAfterQty("");
    setRebatePerUnit(0);
    setSupplierId(suppliers[0]?.id ?? "");
    setSoItemId("");
    setDeliveryAddress(branchAddress?.trim() || "");
    setExpectedDate("");
    setNotes("");
    setLines([]);
    setError(null);
  }, [open, suppliers, branchAddress]);

  useEffect(() => {
    if (ownershipMode === "consignment") {
      setPayTrigger("on_sale");
    } else if (payTrigger === "on_sale") {
      setPayTrigger("on_receipt_credit");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownershipMode]);

  useEffect(() => {
    if (!isRegular) return;
    setDeliveryAddress(branchAddress?.trim() || "");
  }, [isRegular, branchAddress, poType]);

  useEffect(() => {
    if (poType !== "indent" || !selectedSoItem) return;
    setDeliveryAddress(selectedSoItem.deliveryAddress ?? "");
    setLines([
      {
        key: selectedSoItem.soItemId,
        product_id: selectedSoItem.productId,
        product_name: selectedSoItem.productName,
        sku: selectedSoItem.sku,
        unit: selectedSoItem.unit,
        ordered_qty: selectedSoItem.remainingQty,
        purchase_price: selectedSoItem.purchasePrice,
        old_hpp: selectedSoItem.purchasePrice,
        selling_price: selectedSoItem.purchasePrice,
        stock: 0,
      },
    ]);
  }, [poType, selectedSoItem]);

  useEffect(() => {
    if (poType === "regular") {
      setSoItemId("");
      setLines([]);
    }
  }, [poType]);

  const applyLineCost = (
    line: LineDraft,
    patch: Partial<Pick<LineDraft, "ordered_qty" | "purchase_price">>,
  ): LineDraft => ({ ...line, ...patch });

  const addLine = () => {
    const p = products.find((x) => x.productId === addProductId);
    if (!p || lines.some((l) => l.product_id === p.productId)) return;
    setLines((prev) => [
      ...prev,
      {
        key: p.productId,
        product_id: p.productId,
        product_name: p.name,
        sku: p.sku,
        unit: p.unit,
        ordered_qty: 1,
        purchase_price: p.purchasePrice,
        old_hpp: p.purchasePrice,
        selling_price: p.sellingPrice,
        stock: p.stock,
      },
    ]);
    setAddProductId("");
  };

  const linesSubtotal = lines.reduce((s, l) => s + l.ordered_qty * l.purchase_price, 0);

  const handleSubmit = async () => {
    setError(null);
    const result = await onSubmit({
      type: poType,
      ownership_mode: ownershipMode,
      pay_trigger: payTrigger,
      discount_amount: Math.max(0, Math.min(discountAmount, linesSubtotal)),
      rebate_after_qty:
        ownershipMode === "consignment" && rebateAfterQty.trim()
          ? Math.max(1, Number(rebateAfterQty) || 0)
          : null,
      rebate_per_unit: ownershipMode === "consignment" ? Math.max(0, rebatePerUnit) : 0,
      supplier_id: supplierId,
      sales_order_id: isIndent && selectedSoItem ? selectedSoItem.salesOrderId : null,
      sales_order_number: isIndent && selectedSoItem ? selectedSoItem.soNumber : null,
      so_item_id: isIndent && selectedSoItem ? selectedSoItem.soItemId : null,
      delivery_address: deliveryAddress.trim() || null,
      expected_date: expectedDate || null,
      notes: notes.trim() || null,
      items: lines,
    });
    if (!result.success) setError(result.error ?? "Gagal membuat PO");
  };

  const canSubmit =
    lines.length > 0 &&
    Boolean(supplierId) &&
    (!isIndent || (soItemId && indentSoItemOptions.some((o) => o.soItemId === soItemId)));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Purchase Order Baru</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Tipe PO</Label>
            <Select value={poType} onValueChange={(v) => setPoType(v as DbPoType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Reguler (restock cabang)</SelectItem>
                <SelectItem value="indent">Indent (dari Sales Order)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Supplier *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kepemilikan</Label>
            <Select
              value={ownershipMode}
              onValueChange={(v) => setOwnershipMode(v as DbPoOwnership)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owned">Milik toko (kulak / beli)</SelectItem>
                <SelectItem value="consignment">Konsinyasi (milik sales)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cara bayar</Label>
            {ownershipMode === "consignment" ? (
              <p className="text-sm rounded-md border bg-muted/40 px-3 py-2 text-muted-foreground">
                Saat terjual — hutang muncul setelah barang laku di kasir
              </p>
            ) : (
              <Select
                value={payTrigger === "on_sale" ? "on_receipt_credit" : payTrigger}
                onValueChange={(v) => setPayTrigger(v as DbPoPayTrigger)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_receipt_credit">Tempo (hutang saat terima)</SelectItem>
                  <SelectItem value="on_receipt_cash">COD / tunai (lunas saat terima)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {ownershipMode === "owned" && (
          <div className="space-y-1.5">
            <Label>Diskon invoice (Rp)</Label>
            <Input
              inputMode="numeric"
              placeholder="0"
              value={formatIdrInput(discountAmount)}
              onChange={(e) => setDiscountAmount(parseIdrInput(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              COD: diskon dicatat sebagai keuntungan (Diskon Pembelian). Tempo: mengurangi
              hutang.
            </p>
          </div>
        )}

        {ownershipMode === "consignment" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Rebate setelah terjual (qty)</Label>
              <Input
                inputMode="numeric"
                className="h-8 min-w-[5.5rem] px-2 text-center tabular-nums"
                placeholder="mis. 100"
                value={rebateAfterQty}
                onChange={(e) => setRebateAfterQty(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Potongan per unit (Rp)</Label>
              <Input
                inputMode="numeric"
                placeholder="0"
                value={formatIdrInput(rebatePerUnit)}
                onChange={(e) => setRebatePerUnit(parseIdrInput(e.target.value))}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Setelah qty terjual mencapai threshold, hutang settle memakai harga − potongan
              per unit. HPP milik toko tidak diubah oleh harga konsinyasi.
            </p>
          </div>
        )}

        {isIndent && (
          <div className="space-y-1.5">
            <Label>Baris Sales Order *</Label>
            {indentSoItemOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                Tidak ada baris SO yang tersedia. Setiap baris SO hanya boleh punya satu PO
                indent aktif — buat via fulfillment SO atau batalkan PO indent yang ada.
              </p>
            ) : (
              <Select value={soItemId} onValueChange={setSoItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih baris SO..." />
                </SelectTrigger>
                <SelectContent>
                  {indentSoItemOptions.map((o) => (
                    <SelectItem key={o.soItemId} value={o.soItemId}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label>{isIndent ? "Alamat Kirim ke Klien" : "Alamat Pengiriman (cabang)"}</Label>
          <Input
            value={deliveryAddress}
            readOnly={isRegular}
            disabled={isRegular}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            className={isRegular ? "bg-muted" : undefined}
          />
          {isRegular ? (
            <p className="text-xs text-muted-foreground">
              Restock cabang — alamat mengikuti alamat cabang aktif, tidak bisa diubah.
            </p>
          ) : null}
        </div>

        {!isIndent && (
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1.5">
              <Label>Tambah Produk</Label>
              <Select value={addProductId} onValueChange={setAddProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih produk..." />
                </SelectTrigger>
                <SelectContent>
                  {products
                    .filter((p) => !lines.some((l) => l.product_id === p.productId))
                    .map((p) => (
                      <SelectItem key={p.productId} value={p.productId}>
                        {p.name} — HPP {p.purchasePrice.toLocaleString("id-ID")}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={addLine} disabled={!addProductId}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {lines.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="w-28 text-center">Qty</TableHead>
                  <TableHead className="w-24 text-right">Harga lama</TableHead>
                  <TableHead className="w-28 text-center">Harga terkini</TableHead>
                  <TableHead className="w-28 text-right">Harga jual</TableHead>
                  {!isIndent && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const avgHpp = weightedAvgHpp(
                    line.stock,
                    line.old_hpp,
                    line.ordered_qty,
                    line.purchase_price,
                  );
                  const priceChanged =
                    ownershipMode === "owned" && hppDiffers(line.old_hpp, line.purchase_price);
                  const stockAfter = line.stock + line.ordered_qty;
                  const marginNow = line.selling_price - line.old_hpp;
                  const marginIfHppAvg = line.selling_price - avgHpp;
                  return (
                  <TableRow key={line.key} className="align-top">
                    <TableCell className="text-sm">
                      <div>{line.product_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Stok {line.stock} → {stockAfter} {line.unit} · HPP rata-rata{" "}
                        {avgHpp.toLocaleString("id-ID")}
                      </div>
                      {priceChanged ? (
                        <div className="text-[11px] text-amber-800 mt-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-1">
                          Harga PO berubah {line.old_hpp.toLocaleString("id-ID")} →{" "}
                          {line.purchase_price.toLocaleString("id-ID")}. Harga jual tetap{" "}
                          {line.selling_price.toLocaleString("id-ID")} (margin{" "}
                          {marginNow.toLocaleString("id-ID")} →{" "}
                          {marginIfHppAvg.toLocaleString("id-ID")}/unit setelah terima). Ubah
                          harga jual di Master Barang / Inventory.
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="numeric"
                        className="h-8 min-w-[5.5rem] w-full px-2 text-center tabular-nums"
                        value={line.ordered_qty || ""}
                        disabled={isIndent}
                        onChange={(e) => {
                          const n = parseIdrInput(e.target.value);
                          setLines((prev) =>
                            prev.map((l) =>
                              l.key === line.key
                                ? applyLineCost(l, {
                                    ordered_qty: Math.max(1, n || 1),
                                  })
                                : l,
                            ),
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                      {line.old_hpp.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="numeric"
                        className="h-8 text-center"
                        value={formatIdrInput(line.purchase_price)}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.key === line.key
                                ? applyLineCost(l, {
                                    purchase_price: parseIdrInput(e.target.value),
                                  })
                                : l,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {formatIdrInput(line.selling_price) || "—"}
                    </TableCell>
                    {!isIndent && (
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setLines((p) => p.filter((l) => l.key !== line.key))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-between px-3 py-2 text-sm border-t bg-muted/30">
              <span className="text-muted-foreground">Subtotal beli</span>
              <CurrencyDisplay value={linesSubtotal} />
            </div>
            <p className="px-3 py-2 text-[11px] text-muted-foreground border-t">
              Harga jual tidak diubah dari PO — atur di Master Barang. Jika harga beli PO
              beda dari HPP lama, muncul peringatan; setelah GR, HPP stok memakai rata-rata
              tertimbang.
            </p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Tanggal diharapkan</Label>
            <Input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Catatan</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || loading}
            onClick={() => void handleSubmit()}
          >
            {loading ? "Menyimpan…" : "Buat PO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

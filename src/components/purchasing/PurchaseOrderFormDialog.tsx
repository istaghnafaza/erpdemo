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

import type { Supplier, DbPoType } from "@/types/database";

import type { IndentSoItemOption, PoProductOption } from "@/hooks/usePurchaseOrders";



interface LineDraft {

  key: string;

  product_id: string | null;

  product_name: string;

  sku: string;

  unit: string;

  ordered_qty: number;

  purchase_price: number;

}



interface PurchaseOrderFormDialogProps {

  open: boolean;

  onClose: () => void;

  suppliers: Supplier[];

  products: PoProductOption[];

  indentSoItemOptions: IndentSoItemOption[];

  loading: boolean;

  onSubmit: (data: {

    type: DbPoType;

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

  loading,

  onSubmit,

}: PurchaseOrderFormDialogProps) {

  const [poType, setPoType] = useState<DbPoType>("regular");

  const [supplierId, setSupplierId] = useState("");

  const [soItemId, setSoItemId] = useState("");

  const [deliveryAddress, setDeliveryAddress] = useState("");

  const [expectedDate, setExpectedDate] = useState("");

  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<LineDraft[]>([]);

  const [addProductId, setAddProductId] = useState("");

  const [error, setError] = useState<string | null>(null);



  const selectedSoItem = indentSoItemOptions.find((o) => o.soItemId === soItemId);



  useEffect(() => {

    if (!open) return;

    setPoType("regular");

    setSupplierId(suppliers[0]?.id ?? "");

    setSoItemId("");

    setDeliveryAddress("");

    setExpectedDate("");

    setNotes("");

    setLines([]);

    setError(null);

  }, [open, suppliers]);



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

      },

    ]);

  }, [poType, selectedSoItem]);



  useEffect(() => {

    if (poType === "regular") {

      setSoItemId("");

    }

  }, [poType]);



  const grandTotal = lines.reduce((s, l) => s + l.ordered_qty * l.purchase_price, 0);

  const isIndent = poType === "indent";



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

      },

    ]);

    setAddProductId("");

  };



  const handleSubmit = async () => {

    setError(null);

    const result = await onSubmit({

      type: poType,

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

    (!isIndent || (soItemId && indentSoItemOptions.some((o) => o.soItemId === soItemId)));



  return (

    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

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

        </div>



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

            {selectedSoItem && (

              <p className="text-xs text-muted-foreground">

                Pelanggan: {selectedSoItem.customerName} · Baris dengan supplier sama
                digabung ke satu nomor PO indent

              </p>

            )}

          </div>

        )}



        <div className="space-y-1.5">

          <Label>{isIndent ? "Alamat Kirim ke Klien" : "Alamat Pengiriman"}</Label>

          <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />

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

                  <TableHead className="w-20 text-center">Qty</TableHead>

                  <TableHead className="w-28 text-center">Harga Beli</TableHead>

                  {!isIndent && <TableHead className="w-10" />}

                </TableRow>

              </TableHeader>

              <TableBody>

                {lines.map((line) => (

                  <TableRow key={line.key}>

                    <TableCell className="text-sm">{line.product_name}</TableCell>

                    <TableCell>

                      <Input

                        type="number"

                        min={1}

                        max={isIndent ? selectedSoItem?.remainingQty : undefined}

                        className="h-8 text-center"

                        value={line.ordered_qty}

                        disabled={isIndent}

                        onChange={(e) =>

                          setLines((prev) =>

                            prev.map((l) =>

                              l.key === line.key

                                ? { ...l, ordered_qty: Math.max(1, Number(e.target.value) || 1) }

                                : l,

                            ),

                          )

                        }

                      />

                    </TableCell>

                    <TableCell>

                      <Input

                        type="number"

                        min={0}

                        className="h-8 text-center"

                        value={line.purchase_price}

                        onChange={(e) =>

                          setLines((prev) =>

                            prev.map((l) =>

                              l.key === line.key

                                ? {

                                    ...l,

                                    purchase_price: Math.max(0, Number(e.target.value) || 0),

                                  }

                                : l,

                            ),

                          )

                        }

                      />

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

                ))}

              </TableBody>

            </Table>

          </div>

        )}



        <div className="grid sm:grid-cols-2 gap-4">

          <div className="space-y-1.5">

            <Label>Estimasi Terima</Label>

            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />

          </div>

          <div className="flex items-end justify-end">

            <div className="text-right">

              <div className="text-xs text-muted-foreground">Grand Total</div>

              <div className="text-lg font-bold">

                <CurrencyDisplay value={grandTotal} />

              </div>

            </div>

          </div>

        </div>



        <div className="space-y-1.5">

          <Label>Catatan</Label>

          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        </div>



        {error && <p className="text-sm text-destructive">{error}</p>}



        <DialogFooter>

          <Button variant="outline" onClick={onClose} disabled={loading}>

            Batal

          </Button>

          <Button

            className="bg-orange-600 hover:bg-orange-700"

            disabled={loading || !canSubmit}

            onClick={() => void handleSubmit()}

          >

            {loading ? "Menyimpan..." : "Simpan Draft PO"}

          </Button>

        </DialogFooter>

      </DialogContent>

    </Dialog>

  );

}


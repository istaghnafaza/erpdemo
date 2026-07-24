import { useEffect, useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
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
import type { Customer } from "@/types/database";
import type { SoProductOption } from "@/hooks/useSalesOrders";
import type { CreateSoItemDraft } from "@/stores/sales-orders.store";
import { getSoItemEditMeta } from "@/stores/sales-orders.store";
import type { MockSalesOrderWithDetails } from "@/lib/mock-sales-orders";

interface LineDraft extends CreateSoItemDraft {
  key: string;
  soItemId?: string | null;
  locked?: boolean;
  minQty?: number;
  canRemove?: boolean;
}

interface SalesOrderFormDialogProps {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  products: SoProductOption[];
  loading: boolean;
  editingOrder?: MockSalesOrderWithDetails | null;
  onSubmit: (data: {
    customer_id: string | null;
    customer_name: string;
    delivery_address: string | null;
    discount_amount: number;
    down_payment: number;
    estimated_delivery_date: string | null;
    notes: string | null;
    items: (CreateSoItemDraft & { id?: string | null })[];
  }) => Promise<{ success: boolean; error?: string }>;
}

export function SalesOrderFormDialog({
  open,
  onClose,
  customers,
  products,
  loading,
  editingOrder,
  onSubmit,
}: SalesOrderFormDialogProps) {
  const isEdit = Boolean(editingOrder);

  const [customerId, setCustomerId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [downPayment, setDownPayment] = useState("0");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (editingOrder) {
      setCustomerId(editingOrder.customer_id ?? customers[0]?.id ?? "");
      setDeliveryAddress(editingOrder.delivery_address ?? "");
      setDiscountAmount(String(editingOrder.discount_amount));
      setDownPayment(String(editingOrder.down_payment));
      setDeliveryDate(editingOrder.estimated_delivery_date ?? "");
      setNotes(editingOrder.notes ?? "");
      setLines(
        editingOrder.items.map((item) => {
          const meta = getSoItemEditMeta(item, editingOrder);
          return {
            key: item.id,
            soItemId: item.id,
            product_id: item.product_id ?? "",
            product_name: item.product_name,
            sku: item.sku,
            unit: item.unit,
            qty: item.qty,
            selling_price: item.selling_price,
            discount: item.discount,
            locked: meta.locked,
            minQty: meta.minQty,
            canRemove: meta.canRemove,
          };
        }),
      );
    } else {
      setCustomerId(customers[0]?.id ?? "");
      setDeliveryAddress("");
      setDiscountAmount("0");
      setDownPayment("0");
      setDeliveryDate("");
      setNotes("");
      setLines([]);
    }

    setError(null);
    setAddProductId("");
  }, [open, customers, editingOrder]);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.selling_price - l.discount, 0);
  const grandTotal = Math.max(0, subtotal - (Number(discountAmount) || 0));

  const addLine = () => {
    const p = products.find((x) => x.productId === addProductId);
    if (!p || lines.some((l) => l.product_id === p.productId)) return;
    setLines((prev) => [
      ...prev,
      {
        key: `new-${p.productId}`,
        soItemId: null,
        product_id: p.productId,
        product_name: p.name,
        sku: p.sku,
        unit: p.unit,
        qty: 1,
        selling_price: p.sellingPrice,
        discount: 0,
        locked: false,
        minQty: 1,
        canRemove: true,
      },
    ]);
    setAddProductId("");
  };

  const updateLine = (key: string, field: "qty" | "discount", value: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        if (field === "qty") {
          const min = l.minQty ?? 1;
          return { ...l, qty: Math.max(min, value) };
        }
        return { ...l, discount: Math.max(0, value) };
      }),
    );
  };

  const removeLine = (key: string) => {
    setLines((prev) => {
      const line = prev.find((l) => l.key === key);
      if (line?.canRemove === false) return prev;
      return prev.filter((l) => l.key !== key);
    });
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      setError("Pilih pelanggan");
      return;
    }
    setError(null);
    const result = await onSubmit({
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.name,
      delivery_address: deliveryAddress.trim() || null,
      discount_amount: Number(discountAmount) || 0,
      down_payment: Number(downPayment) || 0,
      estimated_delivery_date: deliveryDate || null,
      notes: notes.trim() || null,
      items: lines.map(({ key: _k, locked: _l, minQty: _m, canRemove: _r, soItemId, ...rest }) => ({
        ...rest,
        id: soItemId ?? null,
      })),
    });
    if (!result.success) setError(result.error ?? "Gagal menyimpan SO");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${editingOrder?.so_number}` : "Sales Order Baru"}
          </DialogTitle>
        </DialogHeader>

        {isEdit && (
          <p className="text-xs text-muted-foreground -mt-2">
            Baris yang sudah fulfillment / PO indent tidak bisa dihapus atau diganti produknya. Qty
            tidak boleh di bawah jumlah terkirim.
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Pelanggan *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih pelanggan" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estimasi Kirim</Label>
            <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Alamat Pengiriman</Label>
          <Input
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Alamat proyek / pelanggan"
          />
        </div>

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
                      {p.name} ({p.sku}) — stok {p.availableStock}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={addLine} disabled={!addProductId}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {lines.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="w-20 text-center">Qty</TableHead>
                  <TableHead className="w-24 text-center">Diskon</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.key}>
                    <TableCell>
                      <div className="flex items-start gap-1.5">
                        {line.locked && (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        )}
                        <div>
                          <div className="text-sm font-medium">{line.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {line.sku}
                            {line.minQty && line.minQty > 1 ? ` · min ${line.minQty}` : ""}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={line.minQty ?? 1}
                        className="h-8 text-center"
                        value={line.qty}
                        onChange={(e) =>
                          updateLine(line.key, "qty", Number(e.target.value) || line.minQty || 1)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-center"
                        value={line.discount}
                        onChange={(e) =>
                          updateLine(line.key, "discount", Number(e.target.value) || 0)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <CurrencyDisplay value={line.qty * line.selling_price - line.discount} />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        disabled={line.canRemove === false}
                        onClick={() => removeLine(line.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Diskon Order (Rp)</Label>
            <Input
              type="number"
              min={0}
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Down Payment (Rp)</Label>
            <Input
              type="number"
              min={0}
              value={downPayment}
              onChange={(e) => setDownPayment(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Catatan</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <div className="flex justify-between items-center rounded-lg bg-muted/40 p-3">
          <span className="text-sm text-muted-foreground">Grand Total</span>
          <span className="text-lg font-bold">
            <CurrencyDisplay value={grandTotal} />
          </span>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={loading || lines.length === 0}
            onClick={() => void handleSubmit()}
          >
            {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Draft SO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

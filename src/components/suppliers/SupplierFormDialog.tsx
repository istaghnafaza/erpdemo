import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SupplierFormInput } from "@/stores/suppliers.store";
import type { SupplierProductOption } from "@/hooks/useSuppliersPage";
import type { SupplierWithProducts } from "@/types/database";

export interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SupplierWithProducts | null;
  productOptions: SupplierProductOption[];
  loading: boolean;
  onSubmit: (values: SupplierFormInput) => Promise<{ success: boolean; error?: string }>;
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  editing,
  productOptions,
  loading,
  onSubmit,
}: SupplierFormDialogProps) {
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [paymentTermDays, setPaymentTermDays] = useState("30");
  const [isActive, setIsActive] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [preferredProductId, setPreferredProductId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setContactPerson(editing?.contact_person ?? "");
    setPhone(editing?.phone ?? "");
    setAddress(editing?.address ?? "");
    setEmail(editing?.email ?? "");
    setPaymentTermDays(String(editing?.payment_term_days ?? 30));
    setIsActive(editing?.is_active ?? true);
    const ids = editing?.product_ids ?? [];
    setSelectedProductIds(ids);
    setPreferredProductId(ids[0] ?? null);
    setProductSearch("");
    setError(null);
  }, [open, editing]);

  const title = useMemo(() => (editing ? "Edit supplier" : "Tambah supplier"), [editing]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return productOptions;
    return productOptions.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [productOptions, productSearch]);

  const toggleProduct = (productId: string, checked: boolean) => {
    setSelectedProductIds((prev) => {
      if (checked) {
        const next = [...prev, productId];
        if (!preferredProductId) setPreferredProductId(productId);
        return next;
      }
      const next = prev.filter((id) => id !== productId);
      if (preferredProductId === productId) setPreferredProductId(next[0] ?? null);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Nama supplier wajib diisi");
      return;
    }
    const result = await onSubmit({
      name: name.trim(),
      contact_person: contactPerson.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      email: email.trim() || null,
      payment_term_days: Number(paymentTermDays) || 30,
      is_active: isActive,
      product_ids: selectedProductIds,
      preferred_product_id: preferredProductId,
    });
    if (!result.success) setError(result.error ?? "Gagal menyimpan");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nama supplier *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Kontak</Label>
              <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>No. WhatsApp / Telepon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxx" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Alamat</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Termin bayar (hari)</Label>
              <Input
                type="number"
                min={0}
                value={paymentTermDays}
                onChange={(e) => setPaymentTermDays(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
            Supplier aktif
          </label>

          <div className="space-y-2 border rounded-lg p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">Produk yang disuplai</Label>
              <span className="text-xs text-muted-foreground">{selectedProductIds.length} dipilih</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Hanya supplier terpaut yang muncul saat fulfillment indent SO untuk produk tersebut.
            </p>
            <Input
              placeholder="Cari SKU / nama produk..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="h-8"
            />
            <ScrollArea className="h-44 rounded-md border p-2">
              <div className="space-y-1">
                {filteredProducts.map((p) => {
                  const checked = selectedProductIds.includes(p.id);
                  const isPreferred = preferredProductId === p.id;
                  return (
                    <div
                      key={p.id}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleProduct(p.id, v === true)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm leading-tight">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.sku} · {p.unit}
                        </div>
                      </div>
                      {checked && (
                        <Button
                          type="button"
                          size="sm"
                          variant={isPreferred ? "default" : "outline"}
                          className="h-6 text-[10px] shrink-0"
                          onClick={() => setPreferredProductId(p.id)}
                        >
                          {isPreferred ? "Utama" : "Jadikan utama"}
                        </Button>
                      )}
                    </div>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Produk tidak ditemukan</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Batal
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={loading}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

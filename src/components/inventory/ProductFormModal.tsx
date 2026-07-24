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

import { Switch } from "@/components/ui/switch";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { SmartProductNameBuilder } from "@/components/inventory/SmartProductNameBuilder";

import {

  buildBulkMaterialName,

  buildProductSkuFromAttributes,

  ensureUniqueSku,

  listActiveAttributesForCategory,

} from "@/lib/product-name-builder";

import type { ProductAttributeDefinition, ProductAttributeSelections } from "@/types/product-attributes";

import type { MockProductOverride } from "@/stores/inventory.store";



interface ProductFormModalProps {

  open: boolean;

  onClose: () => void;

  editing: boolean;

  defaults: (MockProductOverride & { sku?: string; name?: string }) | null;

  categoryNames: string[];

  attributeDefinitions: ProductAttributeDefinition[];

  existingSkus: string[];

  canEditPurchasePrice: boolean;

  onSave: (data: MockProductOverride & { sku: string; name: string }) => Promise<{ success: boolean; error?: string }>;

}



export function ProductFormModal({

  open,

  onClose,

  editing,

  defaults,

  categoryNames,

  attributeDefinitions,

  existingSkus,

  canEditPurchasePrice,

  onSave,

}: ProductFormModalProps) {

  const [sku, setSku] = useState("");

  const [barcode, setBarcode] = useState("");

  const [name, setName] = useState("");

  const [category, setCategory] = useState("");

  const [unit, setUnit] = useState("pcs");

  const [purchasePrice, setPurchasePrice] = useState("");

  const [sellingPrice, setSellingPrice] = useState("");

  const [initialStock, setInitialStock] = useState("");

  const [reorderPoint, setReorderPoint] = useState("");

  const [location, setLocation] = useState("");

  const [legacyStock, setLegacyStock] = useState(false);

  const [selections, setSelections] = useState<ProductAttributeSelections>({});

  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);



  const hasAttributeBuilder = useMemo(

    () => !editing && listActiveAttributesForCategory(attributeDefinitions, category).length > 0,

    [editing, attributeDefinitions, category],

  );



  useEffect(() => {

    if (!open) return;

    setSku(defaults?.sku ?? "");

    setBarcode(defaults?.barcode ?? "");

    setName(defaults?.name ?? "");

    setCategory(defaults?.categoryName ?? categoryNames[0] ?? "");

    setUnit(defaults?.unit ?? "pcs");

    setPurchasePrice(String(defaults?.purchasePrice ?? ""));

    setSellingPrice(String(defaults?.sellingPrice ?? ""));

    setInitialStock(String(defaults?.initialStock ?? ""));

    setReorderPoint(String(defaults?.reorderPoint ?? "5"));

    setLocation(defaults?.warehouseLocation ?? "");

    setLegacyStock((defaults?.legacyStock ?? 0) > 0);

    setSelections({});

    setNameManuallyEdited(false);

    setError(null);

  }, [open, defaults, categoryNames]);



  useEffect(() => {

    if (editing || nameManuallyEdited) return;

    const autoName = buildBulkMaterialName(attributeDefinitions, category, selections);

    if (autoName) setName(autoName);

    const baseSku = buildProductSkuFromAttributes(attributeDefinitions, category, selections);

    if (baseSku) setSku(ensureUniqueSku(baseSku, existingSkus));

  }, [editing, selections, category, attributeDefinitions, existingSkus, nameManuallyEdited]);



  const handleCategoryChange = (next: string) => {

    setCategory(next);

    setSelections({});

    setNameManuallyEdited(false);

    setName("");

    setSku("");

  };



  const handleSubmit = async () => {

    const finalSku = sku.trim();

    const finalName = name.trim();

    if (!finalSku || !finalName) {

      setError("SKU dan Nama wajib diisi");

      return;

    }

    const purchase = Number(purchasePrice) || 0;

    const selling = Number(sellingPrice) || 0;

    if (selling <= purchase) {

      setError("Harga jual harus lebih besar dari harga beli");

      return;

    }

    setSaving(true);

    setError(null);

    const result = await onSave({

      sku: finalSku,

      barcode: barcode.trim() || null,

      name: finalName,

      categoryName: category,

      unit,

      purchasePrice: purchase,

      sellingPrice: selling,

      initialStock: Number(initialStock) || 0,

      reorderPoint: Number(reorderPoint) || 5,

      warehouseLocation: location.trim(),

      legacyStock: legacyStock ? Number(initialStock) || 0 : 0,

    });

    setSaving(false);

    if (result.success) {

      onClose();

    } else {

      setError(result.error ?? "Gagal menyimpan produk");

    }

  };



  return (

    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">

        <DialogHeader>

          <DialogTitle>{editing ? "Edit Produk" : "Tambah Produk"}</DialogTitle>

        </DialogHeader>



        <div className="grid gap-4 py-2">

          <div className="grid grid-cols-2 gap-3">

            <div className="space-y-1.5">

              <Label>Kategori</Label>

              <Select value={category} onValueChange={handleCategoryChange}>

                <SelectTrigger>

                  <SelectValue />

                </SelectTrigger>

                <SelectContent>

                  {categoryNames.map((c) => (

                    <SelectItem key={c} value={c}>

                      {c}

                    </SelectItem>

                  ))}

                </SelectContent>

              </Select>

            </div>

            <div className="space-y-1.5">

              <Label>Satuan</Label>

              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />

            </div>

          </div>



          {hasAttributeBuilder ? (

            <SmartProductNameBuilder

              categoryName={category}

              attributes={attributeDefinitions}

              selections={selections}

              onSelectionsChange={setSelections}

              generatedName={name}

              onGeneratedNameChange={setName}

              generatedSku={sku}

              nameManuallyEdited={nameManuallyEdited}

              onNameManuallyEditedChange={setNameManuallyEdited}

            />

          ) : (

            <>

              <div className="grid grid-cols-2 gap-3">

                <div className="space-y-1.5">

                  <Label>SKU *</Label>

                  <Input value={sku} readOnly disabled className="bg-muted font-mono" />

                </div>

                <div className="space-y-1.5">

                  <Label>Barcode</Label>

                  <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />

                </div>

              </div>

              <div className="space-y-1.5">

                <Label>Nama Produk *</Label>

                <Input value={name} onChange={(e) => setName(e.target.value)} />

              </div>

            </>

          )}



          {hasAttributeBuilder && (

            <div className="space-y-1.5">

              <Label>Barcode</Label>

              <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />

            </div>

          )}



          <div className="grid grid-cols-2 gap-3">

            {canEditPurchasePrice && (

              <div className="space-y-1.5">

                <Label>Harga Beli</Label>

                <Input

                  type="number"

                  value={purchasePrice}

                  onChange={(e) => setPurchasePrice(e.target.value)}

                />

              </div>

            )}

            <div className="space-y-1.5">

              <Label>Harga Jual</Label>

              <Input

                type="number"

                value={sellingPrice}

                onChange={(e) => setSellingPrice(e.target.value)}

              />

            </div>

          </div>



          {!editing && (

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1.5">

                <Label>Stok Awal</Label>

                <Input

                  type="number"

                  value={initialStock}

                  onChange={(e) => setInitialStock(e.target.value)}

                />

              </div>

              <div className="space-y-1.5">

                <Label>Reorder Point</Label>

                <Input

                  type="number"

                  value={reorderPoint}

                  onChange={(e) => setReorderPoint(e.target.value)}

                />

              </div>

            </div>

          )}



          <div className="space-y-1.5">

            <Label>Lokasi Gudang</Label>

            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="A-01" />

          </div>



          <div className="flex items-center justify-between rounded-lg border p-3">

            <div>

              <div className="text-sm font-medium">Legacy Stock</div>

              <div className="text-xs text-muted-foreground">Mode onboarding — stok belum terverifikasi</div>

            </div>

            <Switch checked={legacyStock} onCheckedChange={setLegacyStock} />

          </div>



          {error && <p className="text-sm text-destructive">{error}</p>}

        </div>



        <DialogFooter>

          <Button variant="outline" onClick={onClose} disabled={saving}>

            Batal

          </Button>

          <Button onClick={() => void handleSubmit()} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">

            {saving ? "Menyimpan..." : "Simpan"}

          </Button>

        </DialogFooter>

      </DialogContent>

    </Dialog>

  );

}



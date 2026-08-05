import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Sparkles, X } from "lucide-react";
import {
  buildBulkMaterialName,
  buildProductSkuFromTypeAttributes,
} from "@/lib/product-name-builder";
import { CATEGORY_ATTRIBUTE_HINTS } from "@/lib/product-catalog-seed";
import { resolveCategoryForAttributes } from "@/lib/category-attribute-map";
import { useProductAttributesStore } from "@/stores/product-attributes.store";
import { useCatalogRequestsStore } from "@/stores/catalog-requests.store";
import { useAuthStore } from "@/stores/auth.store";
import { submitCatalogRequest as submitCatalogRequestApi } from "@/lib/api/platform-catalog";
import { isNeonBackend } from "@/lib/api/backend";
import type { NameInclusionFlags, ProductAttributeSelections } from "@/types/product-attributes";
import { PRODUCT_TYPE_NAME_KEY } from "@/types/product-attributes";
import { toast } from "sonner";

export interface SmartProductNameBuilderProps {
  categoryName: string;
  selections: ProductAttributeSelections;
  onSelectionsChange: (next: ProductAttributeSelections) => void;
  productTypeId: string;
  onProductTypeIdChange: (id: string) => void;
  generatedName: string;
  onGeneratedNameChange: (name: string) => void;
  generatedSku: string;
  onGeneratedSkuChange: (sku: string) => void;
  nameManuallyEdited: boolean;
  onNameManuallyEditedChange: (manual: boolean) => void;
}

export function SmartProductNameBuilder({
  categoryName,
  selections,
  onSelectionsChange,
  productTypeId,
  onProductTypeIdChange,
  generatedName,
  onGeneratedNameChange,
  generatedSku,
  onGeneratedSkuChange,
  nameManuallyEdited,
  onNameManuallyEditedChange,
}: SmartProductNameBuilderProps) {
  const listProductTypesForCategory = useProductAttributesStore(
    (s) => s.listProductTypesForCategory,
  );
  const listAttributesForProductType = useProductAttributesStore(
    (s) => s.listAttributesForProductType,
  );
  const getProductType = useProductAttributesStore((s) => s.getProductType);
  const addTypeAttributeValue = useProductAttributesStore((s) => s.addTypeAttributeValue);
  const catalogReadOnly = useProductAttributesStore((s) => s.catalogReadOnly);
  const typeAttributesVersion = useProductAttributesStore((s) => s.typeAttributes);
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentTenant = useAuthStore((s) => s.currentTenant);
  const submitCatalogRequest = useCatalogRequestsStore((s) => s.submitRequest);

  const [nameInclusions, setNameInclusions] = useState<NameInclusionFlags>({});
  const [addingValueFor, setAddingValueFor] = useState<string | null>(null);
  const [newValueLabel, setNewValueLabel] = useState("");
  const [newValueAbbr, setNewValueAbbr] = useState("");

  const productTypes = useMemo(
    () => listProductTypesForCategory(categoryName),
    [listProductTypesForCategory, categoryName],
  );

  const productType = productTypeId ? getProductType(productTypeId) : undefined;

  const typeAttributes = useMemo(
    () => (productTypeId ? listAttributesForProductType(productTypeId) : []),
    [listAttributesForProductType, productTypeId, typeAttributesVersion],
  );

  useEffect(() => {
    if (productTypes.length === 0) {
      if (productTypeId) onProductTypeIdChange("");
      return;
    }
    if (!productTypes.some((pt) => pt.id === productTypeId)) {
      onProductTypeIdChange(productTypes[0].id);
    }
  }, [productTypes, productTypeId, onProductTypeIdChange]);

  useEffect(() => {
    setNameInclusions({ [PRODUCT_TYPE_NAME_KEY]: true });
    setAddingValueFor(null);
    setNewValueLabel("");
    setNewValueAbbr("");
  }, [productTypeId]);

  const attributeHint = useMemo(() => {
    const canonical = resolveCategoryForAttributes(categoryName);
    return CATEGORY_ATTRIBUTE_HINTS[canonical];
  }, [categoryName]);

  const previewName = useMemo(() => {
    if (!productTypeId) return "";
    return buildBulkMaterialName(
      productType,
      typeAttributes,
      categoryName,
      selections,
      nameInclusions,
    );
  }, [productType, typeAttributes, categoryName, selections, productTypeId, nameInclusions]);

  const previewSku = useMemo(() => {
    if (!productTypeId) return "";
    return buildProductSkuFromTypeAttributes(productType, typeAttributes, selections);
  }, [productType, typeAttributes, selections, productTypeId]);

  useEffect(() => {
    if (nameManuallyEdited || !productTypeId) return;
    const autoName = buildBulkMaterialName(
      productType,
      typeAttributes,
      categoryName,
      selections,
      nameInclusions,
    );
    if (autoName) onGeneratedNameChange(autoName);
    const baseSku = buildProductSkuFromTypeAttributes(productType, typeAttributes, selections);
    if (baseSku) onGeneratedSkuChange(baseSku);
  }, [
    selections,
    nameInclusions,
    productTypeId,
    productType,
    typeAttributes,
    categoryName,
    nameManuallyEdited,
    onGeneratedNameChange,
    onGeneratedSkuChange,
  ]);

  const toggleNameInclusion = (key: string, checked: boolean) => {
    setNameInclusions((prev) => ({ ...prev, [key]: checked }));
    onNameManuallyEditedChange(false);
  };

  const handleAddValue = async (assignmentId: string, attrName: string) => {
    const trimmed = newValueLabel.trim();
    if (!trimmed) {
      toast.error("Nilai wajib diisi");
      return;
    }

    if (catalogReadOnly) {
      if (!currentUser?.tenantId) {
        toast.error("Sesi tidak valid");
        return;
      }
      const payload = {
        tenantId: currentUser.tenantId,
        tenantName: currentTenant?.name ?? "Toko",
        kind: "attribute_value" as const,
        categoryName,
        productTypeName: productType?.name,
        attributeName: attrName,
        proposedLabel: trimmed,
        proposedAbbreviation: newValueAbbr || undefined,
      };
      if (isNeonBackend()) {
        const r = await submitCatalogRequestApi(payload);
        if (r.error) {
          toast.error(r.error);
          return;
        }
      } else {
        submitCatalogRequest(payload);
      }
      toast.success("Permintaan nilai baru dikirim ke developer");
      setAddingValueFor(null);
      setNewValueLabel("");
      setNewValueAbbr("");
      return;
    }

    const r = addTypeAttributeValue(assignmentId, trimmed, newValueAbbr || undefined);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`"${trimmed}" ditambahkan ke master`);
    if (r.id) {
      onSelectionsChange({ ...selections, [assignmentId]: r.id });
      setNameInclusions((prev) => ({ ...prev, [assignmentId]: prev[assignmentId] ?? true }));
    }
    setAddingValueFor(null);
    setNewValueLabel("");
    setNewValueAbbr("");
    onNameManuallyEditedChange(false);
  };

  if (productTypes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3">
        Belum ada jenis barang untuk kategori ini. Atur di{" "}
        <span className="font-medium">Pengaturan → Master Data → Attribute Produk</span>.
      </p>
    );
  }

  const hasAnySelection = Boolean(productTypeId) || Object.keys(selections).length > 0;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-cyan-600" />
        Smart Product Name Builder
      </div>
      {attributeHint && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Pilih spesifikasi per attribute. Centang &quot;Nama&quot; untuk bagian yang masuk penamaan
          produk — SKU tetap lengkap dari semua attribute terpilih.
        </p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Jenis Barang *</Label>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
            <Checkbox
              checked={nameInclusions[PRODUCT_TYPE_NAME_KEY] !== false}
              onCheckedChange={(c) => toggleNameInclusion(PRODUCT_TYPE_NAME_KEY, c === true)}
            />
            Nama
          </label>
        </div>
        <Select value={productTypeId} onValueChange={onProductTypeIdChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Pilih jenis barang" />
          </SelectTrigger>
          <SelectContent>
            {productTypes.map((pt) => (
              <SelectItem key={pt.id} value={pt.id}>
                {pt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {typeAttributes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {typeAttributes.map((attr) => {
            const activeValues = attr.values
              .filter((v) => v.isActive)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            const isAdding = addingValueFor === attr.assignmentId;
            const hasSelection = Boolean(selections[attr.assignmentId]);

            return (
              <div key={attr.assignmentId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">{attr.name}</Label>
                  {hasSelection && (
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer shrink-0">
                      <Checkbox
                        checked={nameInclusions[attr.assignmentId] !== false}
                        onCheckedChange={(c) =>
                          toggleNameInclusion(attr.assignmentId, c === true)
                        }
                      />
                      Nama
                    </label>
                  )}
                </div>

                {isAdding ? (
                  <div className="rounded-md border bg-background p-2 space-y-2">
                    <Input
                      className="h-8 text-sm"
                      placeholder={`Nilai ${attr.name.toLowerCase()} baru`}
                      value={newValueLabel}
                      onChange={(e) => setNewValueLabel(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleAddValue(attr.assignmentId, attr.name);
                        if (e.key === "Escape") setAddingValueFor(null);
                      }}
                    />
                    <Input
                      className="h-8 text-xs font-mono"
                      placeholder="Singkatan SKU (opsional)"
                      value={newValueAbbr}
                      onChange={(e) => setNewValueAbbr(e.target.value)}
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-7 flex-1"
                        disabled={!newValueLabel.trim()}
                        onClick={() => void handleAddValue(attr.assignmentId, attr.name)}
                      >
                        Simpan
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => {
                          setAddingValueFor(null);
                          setNewValueLabel("");
                          setNewValueAbbr("");
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {catalogReadOnly
                        ? "Dikirim ke developer — setelah diterbitkan bisa dipilih di dropdown."
                        : "Disimpan ke master data jenis ini — bisa dipakai produk lain."}
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-1">
                <Select
                  value={selections[attr.assignmentId] || undefined}
                  onValueChange={(valueId) => {
                        onSelectionsChange({ ...selections, [attr.assignmentId]: valueId });
                        setNameInclusions((prev) => ({
                          ...prev,
                          [attr.assignmentId]: prev[attr.assignmentId] ?? true,
                        }));
                        onNameManuallyEditedChange(false);
                      }}
                    >
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder={`Pilih ${attr.name.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {activeValues.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      title={`Tambah ${attr.name.toLowerCase()} baru`}
                      onClick={() => {
                        setAddingValueFor(attr.assignmentId);
                        setNewValueLabel("");
                        setNewValueAbbr("");
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {typeAttributes.length === 0 && productTypeId && (
        <p className="text-xs text-muted-foreground">
          Jenis barang ini belum punya attribute — tambahkan di Master Data.
        </p>
      )}

      {hasAnySelection && (previewName || previewSku) && (
        <div className="rounded-md bg-background border px-3 py-2 text-xs space-y-1">
          {previewName && (
            <div>
              <span className="text-muted-foreground">Preview nama: </span>
              <span className="font-medium">{previewName}</span>
            </div>
          )}
          {previewSku && (
            <div>
              <span className="text-muted-foreground">Preview SKU: </span>
              <span className="font-mono font-medium">{previewSku}</span>
              <span className="text-muted-foreground ml-1">(semua attribute)</span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Nama Produk *</Label>
        <Input
          value={generatedName}
          onChange={(e) => {
            onNameManuallyEditedChange(true);
            onGeneratedNameChange(e.target.value);
          }}
          placeholder={previewName || "Nama terbentuk otomatis dari pilihan di atas"}
        />
        <p className="text-[11px] text-muted-foreground">
          Hanya bagian yang dicentang &quot;Nama&quot; yang masuk otomatis — bisa diedit manual.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>SKU *</Label>
        <Input
          value={generatedSku || previewSku}
          readOnly
          disabled
          className="bg-muted font-mono"
        />
        <p className="text-[11px] text-muted-foreground">
          SKU dari jenis + semua attribute terpilih ({generatedSku || previewSku || "—"}).
        </p>
      </div>
    </div>
  );
}

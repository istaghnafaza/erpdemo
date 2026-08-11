import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Globe,
  Layers,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_ATTRIBUTE_HINTS } from "@/lib/product-catalog-seed";
import { resolveCategoryForAttributes } from "@/lib/category-attribute-map";
import { cn } from "@/lib/utils";
import type { useProductAttributesPage } from "@/hooks/useProductAttributesPage";
import { toast } from "sonner";

type ProductCatalogEditorProps = ReturnType<typeof useProductAttributesPage>;

export function ProductCatalogEditor(props: ProductCatalogEditorProps) {
  const {
    canEditCatalog,
    categories,
    categoryEntities,
    selectedCategory,
    setSelectedCategory,
    globalAttributes,
    categoryProductTypes,
    selectedProductTypeId,
    setSelectedProductTypeId,
    productTypeAttributes,
    availableGlobalAttributes,
    addCategory,
    updateCategory,
    addGlobalAttribute,
    addProductType,
    updateProductType,
    reorderProductType,
    assignGlobalAttribute,
    removeTypeAttribute,
    updateTypeAttribute,
    reorderTypeAttribute,
    addTypeAttributeValue,
    updateTypeAttributeValue,
    reorderTypeAttributeValue,
  } = props;

  const canEdit = canEditCatalog;
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [newGlobalAttrName, setNewGlobalAttrName] = useState("");
  const [newProductTypeName, setNewProductTypeName] = useState("");
  const [selectedGlobalAttrId, setSelectedGlobalAttrId] = useState("");
  const [expandedAttrId, setExpandedAttrId] = useState<string | null>(null);
  const [newValueLabel, setNewValueLabel] = useState<Record<string, string>>({});
  const [newValueAbbr, setNewValueAbbr] = useState<Record<string, string>>({});

  const selectedProductType = categoryProductTypes.find((pt) => pt.id === selectedProductTypeId);
  const selectedCategoryEntity = categoryEntities.find((c) => c.name === selectedCategory);

  return (
    <>
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Atribut Global</h2>
          <Badge variant="secondary" className="text-[10px]">
            {globalAttributes.filter((g) => g.isActive).length} aktif
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {globalAttributes
            .filter((g) => g.isActive)
            .map((g) => (
              <Badge key={g.id} variant="outline" className="text-xs font-normal">
                {g.name}
              </Badge>
            ))}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Input
              className="h-9 max-w-xs"
              placeholder="Nama atribut global baru"
              value={newGlobalAttrName}
              onChange={(e) => setNewGlobalAttrName(e.target.value)}
            />
            <Button
              size="sm"
              onClick={() => {
                const r = addGlobalAttribute(newGlobalAttrName);
                if (r.ok) {
                  toast.success("Atribut global ditambahkan");
                  setNewGlobalAttrName("");
                } else toast.error(r.error);
              }}
              disabled={!newGlobalAttrName.trim()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Atribut Global
            </Button>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,200px)_minmax(0,220px)_minmax(0,1fr)]">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Tags className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Kategori</h2>
          </div>
          <div className="space-y-1 mb-3">
            {categoryEntities.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.name)}
                className={cn(
                  "w-full text-left rounded-md px-3 py-2 text-sm transition-colors",
                  selectedCategory === cat.name
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted",
                  !cat.isActive && "opacity-50 line-through",
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
          {canEdit && selectedCategoryEntity && (
            <div className="border-t pt-3 space-y-2 mb-3">
              <Input
                className="h-8 text-sm"
                value={selectedCategoryEntity.name}
                onChange={(e) => {
                  const next = e.target.value;
                  const r = updateCategory(selectedCategoryEntity.id, { name: next });
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  setSelectedCategory(next.trim() || selectedCategoryEntity.name);
                }}
              />
              <Input
                className="h-8 text-xs"
                placeholder="Deskripsi kategori"
                value={selectedCategoryEntity.description ?? ""}
                onChange={(e) => {
                  const r = updateCategory(selectedCategoryEntity.id, {
                    description: e.target.value,
                  });
                  if (!r.ok) toast.error(r.error);
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Aktif</span>
                <Switch
                  checked={selectedCategoryEntity.isActive}
                  onCheckedChange={(on) => {
                    const r = updateCategory(selectedCategoryEntity.id, { isActive: on });
                    if (!r.ok) toast.error(r.error);
                  }}
                />
              </div>
            </div>
          )}
          {canEdit && (
            <div className="space-y-2 border-t pt-3">
              <Input
                className="h-8 text-sm"
                placeholder="Kategori baru"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <Input
                className="h-8 text-xs"
                placeholder="Deskripsi (opsional)"
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!newCategoryName.trim()}
                onClick={() => {
                  const r = addCategory(newCategoryName, newCategoryDesc);
                  if (r.ok) {
                    toast.success("Kategori ditambahkan");
                    setNewCategoryName("");
                    setNewCategoryDesc("");
                    setSelectedCategory(newCategoryName.trim());
                  } else toast.error(r.error);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Kategori
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Jenis Barang</h2>
          </div>
          <div className="space-y-1 mb-3">
            {categoryProductTypes.map((pt, idx) => (
              <div
                key={pt.id}
                className={cn(
                  "w-full rounded-md px-1 py-1 flex items-center justify-between gap-1",
                  selectedProductTypeId === pt.id && "bg-primary/10",
                  !pt.isActive && "opacity-50",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedProductTypeId(pt.id)}
                  className={cn(
                    "flex-1 min-w-0 text-left rounded-md px-2 py-1.5 text-sm transition-colors",
                    selectedProductTypeId === pt.id
                      ? "text-primary font-medium"
                      : "hover:bg-muted",
                  )}
                >
                  <span className="truncate block">{pt.name}</span>
                </button>
                {canEdit && selectedProductTypeId === pt.id && (
                  <span className="flex gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={idx === 0}
                      onClick={() => reorderProductType(pt.id, "up")}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={idx === categoryProductTypes.length - 1}
                      onClick={() => reorderProductType(pt.id, "down")}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {canEdit && selectedProductType && (
            <div className="border-t pt-3 space-y-2 mb-3">
              <Input
                className="h-8 text-sm"
                value={selectedProductType.name}
                onChange={(e) => {
                  const r = updateProductType(selectedProductType.id, { name: e.target.value });
                  if (!r.ok) toast.error(r.error);
                }}
              />
              <Input
                className="h-8 text-xs font-mono"
                value={selectedProductType.abbreviation}
                onChange={(e) => {
                  const r = updateProductType(selectedProductType.id, {
                    abbreviation: e.target.value,
                  });
                  if (!r.ok) toast.error(r.error);
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Aktif</span>
                <Switch
                  checked={selectedProductType.isActive}
                  onCheckedChange={(on) => {
                    const r = updateProductType(selectedProductType.id, { isActive: on });
                    if (!r.ok) toast.error(r.error);
                  }}
                />
              </div>
            </div>
          )}
          {canEdit && selectedCategory && (
            <div className="space-y-2 border-t pt-3">
              <Input
                className="h-8 text-sm"
                placeholder="Jenis baru"
                value={newProductTypeName}
                onChange={(e) => setNewProductTypeName(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!newProductTypeName.trim()}
                onClick={() => {
                  const r = addProductType(selectedCategory, newProductTypeName);
                  if (r.ok) {
                    toast.success("Jenis barang ditambahkan");
                    setNewProductTypeName("");
                    if (r.id) setSelectedProductTypeId(r.id);
                  } else toast.error(r.error);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Jenis Barang
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold">{selectedProductType?.name ?? "Pilih jenis barang"}</h2>
              {selectedCategory &&
                CATEGORY_ATTRIBUTE_HINTS[resolveCategoryForAttributes(selectedCategory)] && (
                  <p className="text-xs text-cyan-700 dark:text-cyan-400 mt-1">
                    {CATEGORY_ATTRIBUTE_HINTS[resolveCategoryForAttributes(selectedCategory)]}
                  </p>
                )}
            </div>
            {canEdit && selectedProductTypeId && availableGlobalAttributes.length > 0 && (
              <div className="flex gap-2 items-end">
                <Select
                  value={selectedGlobalAttrId || undefined}
                  onValueChange={setSelectedGlobalAttrId}
                >
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue placeholder="Atribut global" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGlobalAttributes.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-9"
                  disabled={!selectedGlobalAttrId}
                  onClick={() => {
                    const r = assignGlobalAttribute(selectedProductTypeId, selectedGlobalAttrId);
                    if (r.ok) {
                      toast.success("Atribut di-assign");
                      setSelectedGlobalAttrId("");
                      if (r.id) setExpandedAttrId(r.id);
                    } else toast.error(r.error);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {productTypeAttributes.map((attr, attrIdx) => {
              const expanded = expandedAttrId === attr.assignmentId;
              return (
                <div key={attr.assignmentId} className="rounded-lg border">
                  <div className="flex items-center gap-2 p-3">
                    <button type="button" onClick={() => setExpandedAttrId(expanded ? null : attr.assignmentId)}>
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 font-medium text-sm">{attr.name}</div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={attrIdx === 0} onClick={() => reorderTypeAttribute(attr.assignmentId, "up")}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={attrIdx === productTypeAttributes.length - 1} onClick={() => reorderTypeAttribute(attr.assignmentId, "down")}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Switch checked={attr.isActive} onCheckedChange={(on) => updateTypeAttribute(attr.assignmentId, { isActive: on })} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeTypeAttribute(attr.assignmentId)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {expanded && (
                    <div className="border-t px-3 py-3 space-y-2 bg-muted/20">
                      {attr.values.sort((a, b) => a.sortOrder - b.sortOrder).map((val, valIdx) => (
                        <div key={val.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-2 py-1.5">
                          {canEdit ? (
                            <>
                              <Input className="h-8 flex-1 min-w-[120px] text-sm" value={val.label} onChange={(e) => updateTypeAttributeValue(attr.assignmentId, val.id, { label: e.target.value })} />
                              <Input className="h-8 w-20 font-mono text-xs" value={val.abbreviation} onChange={(e) => updateTypeAttributeValue(attr.assignmentId, val.id, { abbreviation: e.target.value })} />
                              <Switch checked={val.isActive} onCheckedChange={(on) => updateTypeAttributeValue(attr.assignmentId, val.id, { isActive: on })} />
                            </>
                          ) : (
                            <>
                              <span className="text-sm flex-1">{val.label}</span>
                              <span className="font-mono text-xs text-muted-foreground">{val.abbreviation}</span>
                            </>
                          )}
                        </div>
                      ))}
                      {canEdit && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Input className="h-8 flex-1" placeholder="Nilai baru" value={newValueLabel[attr.assignmentId] ?? ""} onChange={(e) => setNewValueLabel((s) => ({ ...s, [attr.assignmentId]: e.target.value }))} />
                          <Input className="h-8 w-24 font-mono text-xs" placeholder="Singk." value={newValueAbbr[attr.assignmentId] ?? ""} onChange={(e) => setNewValueAbbr((s) => ({ ...s, [attr.assignmentId]: e.target.value }))} />
                          <Button size="sm" variant="outline" disabled={!newValueLabel[attr.assignmentId]?.trim()} onClick={() => {
                            const r = addTypeAttributeValue(attr.assignmentId, newValueLabel[attr.assignmentId] ?? "", newValueAbbr[attr.assignmentId]);
                            if (r.ok) {
                              toast.success("Nilai ditambahkan");
                              setNewValueLabel((s) => ({ ...s, [attr.assignmentId]: "" }));
                              setNewValueAbbr((s) => ({ ...s, [attr.assignmentId]: "" }));
                            } else toast.error(r.error);
                          }}>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Nilai
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

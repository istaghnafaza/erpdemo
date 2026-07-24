import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
import {
  buildBulkMaterialName,
  buildProductSkuFromAttributes,
  listActiveAttributesForCategory,
} from "@/lib/product-name-builder";
import type { ProductAttributeDefinition, ProductAttributeSelections } from "@/types/product-attributes";

export interface SmartProductNameBuilderProps {
  categoryName: string;
  attributes: ProductAttributeDefinition[];
  selections: ProductAttributeSelections;
  onSelectionsChange: (next: ProductAttributeSelections) => void;
  generatedName: string;
  onGeneratedNameChange: (name: string) => void;
  generatedSku: string;
  nameManuallyEdited: boolean;
  onNameManuallyEditedChange: (manual: boolean) => void;
}

export function SmartProductNameBuilder({
  categoryName,
  attributes,
  selections,
  onSelectionsChange,
  generatedName,
  onGeneratedNameChange,
  generatedSku,
  nameManuallyEdited,
  onNameManuallyEditedChange,
}: SmartProductNameBuilderProps) {
  const categoryAttributes = useMemo(
    () => listActiveAttributesForCategory(attributes, categoryName),
    [attributes, categoryName],
  );

  const previewName = useMemo(() => {
    if (Object.keys(selections).length === 0) return "";
    return buildBulkMaterialName(attributes, categoryName, selections);
  }, [attributes, categoryName, selections]);

  const previewSku = useMemo(() => {
    if (Object.keys(selections).length === 0) return "";
    return buildProductSkuFromAttributes(attributes, categoryName, selections);
  }, [attributes, categoryName, selections]);

  if (categoryAttributes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3">
        Belum ada attribute untuk kategori ini. Atur di{" "}
        <span className="font-medium">Pengaturan → Master Data → Attribute Produk</span>.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-cyan-600" />
        Smart Product Name Builder
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {categoryAttributes.map((attr) => {
          const activeValues = attr.values
            .filter((v) => v.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <div key={attr.id} className="space-y-1.5">
              <Label className="text-xs">{attr.name}</Label>
              <Select
                value={selections[attr.id] ?? ""}
                onValueChange={(valueId) => {
                  const next = { ...selections, [attr.id]: valueId };
                  onSelectionsChange(next);
                  if (!nameManuallyEdited) {
                    onGeneratedNameChange(buildBulkMaterialName(attributes, categoryName, next));
                  }
                }}
              >
                <SelectTrigger className="h-9">
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
            </div>
          );
        })}
      </div>

      {(previewName || previewSku) && (
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
          placeholder={previewName || "Nama terbentuk otomatis dari attribute"}
        />
        <p className="text-[11px] text-muted-foreground">
          Dibuat otomatis dari attribute — masih bisa diedit manual.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>SKU *</Label>
        <Input value={generatedSku || previewSku} readOnly disabled className="bg-muted font-mono" />
        <p className="text-[11px] text-muted-foreground">
          SKU dari singkatan attribute ({generatedSku || previewSku || "—"}).
        </p>
      </div>
    </div>
  );
}

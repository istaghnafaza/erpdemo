import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings2,
  Tags,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MasterDataSubNav } from "@/components/settings/MasterDataSubNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useProductAttributesPage } from "@/hooks/useProductAttributesPage";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/$tenantSlug/settings/master-data/product-attributes")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireFeature(params.tenantSlug, "settings");
  },
  head: () => ({
    meta: [
      { title: "Attribute Produk — Pengaturan" },
      {
        name: "description",
        content: "Kelola attribute produk per kategori untuk Smart Product Name Builder.",
      },
    ],
  }),
  component: ProductAttributesPage,
});

function ProductAttributesPage() {
  const {
    user,
    canEditAttributes,
    categories,
    selectedCategory,
    setSelectedCategory,
    categoryAttributes,
    addAttribute,
    updateAttribute,
    reorderAttribute,
    addValue,
    updateValue,
    reorderValue,
  } = useProductAttributesPage();

  const [newAttrName, setNewAttrName] = useState("");
  const [expandedAttrId, setExpandedAttrId] = useState<string | null>(null);
  const [newValueLabel, setNewValueLabel] = useState<Record<string, string>>({});
  const [newValueAbbr, setNewValueAbbr] = useState<Record<string, string>>({});

  if (!user) return null;

  const handleAddAttribute = () => {
    if (!selectedCategory) return;
    const r = addAttribute(selectedCategory, newAttrName);
    if (r.ok) {
      toast.success("Attribute ditambahkan");
      setNewAttrName("");
      if (r.id) setExpandedAttrId(r.id);
    } else toast.error(r.error);
  };

  return (
    <AppShell
      title="Pengaturan"
      subtitle="Master Data — attribute produk per kategori untuk penamaan & SKU otomatis"
      actions={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          Owner & Manager dapat mengubah
        </div>
      }
    >
      <MasterDataSubNav />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Tags className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Kategori</h2>
          </div>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "w-full text-left rounded-md px-3 py-2 text-sm transition-colors",
                  selectedCategory === cat
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold">{selectedCategory || "Pilih kategori"}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {categoryAttributes.filter((a) => a.isActive).length} attribute aktif
              </p>
            </div>
            {canEditAttributes && selectedCategory && (
              <div className="flex gap-2">
                <Input
                  className="h-9 w-40"
                  placeholder="Nama attribute baru"
                  value={newAttrName}
                  onChange={(e) => setNewAttrName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddAttribute()}
                />
                <Button size="sm" onClick={handleAddAttribute} disabled={!newAttrName.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Attribute
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {categoryAttributes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Belum ada attribute — tambahkan Jenis, Ukuran, Merk, dll.
              </p>
            )}

            {categoryAttributes.map((attr, attrIdx) => {
              const expanded = expandedAttrId === attr.id;
              const activeValues = attr.values
                .filter((v) => v.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              const inactiveCount = attr.values.filter((v) => !v.isActive).length;

              return (
                <div
                  key={attr.id}
                  className={cn(
                    "rounded-lg border",
                    !attr.isActive && "opacity-60 bg-muted/30",
                  )}
                >
                  <div className="flex items-center gap-2 p-3">
                    <button
                      type="button"
                      className="shrink-0"
                      onClick={() => setExpandedAttrId(expanded ? null : attr.id)}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{attr.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {activeValues.length} nilai aktif
                        {inactiveCount > 0 && ` · ${inactiveCount} nonaktif`}
                      </div>
                    </div>
                    {!attr.isActive && (
                      <Badge variant="secondary" className="text-[10px]">
                        Nonaktif
                      </Badge>
                    )}
                    {canEditAttributes && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={attrIdx === 0}
                          onClick={() => reorderAttribute(attr.id, "up")}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={attrIdx === categoryAttributes.length - 1}
                          onClick={() => reorderAttribute(attr.id, "down")}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Switch
                          checked={attr.isActive}
                          onCheckedChange={(on) => {
                            updateAttribute(attr.id, { isActive: on });
                            toast.success(on ? "Attribute diaktifkan" : "Attribute dinonaktifkan");
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {expanded && (
                    <div className="border-t px-3 py-3 space-y-2 bg-muted/20">
                      {attr.values
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((val, valIdx) => (
                          <div
                            key={val.id}
                            className={cn(
                              "flex flex-wrap items-center gap-2 rounded-md border bg-background px-2 py-1.5",
                              !val.isActive && "opacity-50",
                            )}
                          >
                            {canEditAttributes ? (
                              <>
                                <Input
                                  className="h-8 flex-1 min-w-[120px] text-sm"
                                  value={val.label}
                                  onChange={(e) =>
                                    updateValue(attr.id, val.id, { label: e.target.value })
                                  }
                                />
                                <Input
                                  className="h-8 w-20 font-mono text-xs"
                                  value={val.abbreviation}
                                  onChange={(e) =>
                                    updateValue(attr.id, val.id, {
                                      abbreviation: e.target.value,
                                    })
                                  }
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={valIdx === 0}
                                  onClick={() => reorderValue(attr.id, val.id, "up")}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={valIdx === attr.values.length - 1}
                                  onClick={() => reorderValue(attr.id, val.id, "down")}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                                <Switch
                                  checked={val.isActive}
                                  onCheckedChange={(on) =>
                                    updateValue(attr.id, val.id, { isActive: on })
                                  }
                                />
                              </>
                            ) : (
                              <>
                                <span className="text-sm flex-1">{val.label}</span>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {val.abbreviation}
                                </span>
                              </>
                            )}
                          </div>
                        ))}

                      {canEditAttributes && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Input
                            className="h-8 flex-1 min-w-[140px]"
                            placeholder="Nilai baru"
                            value={newValueLabel[attr.id] ?? ""}
                            onChange={(e) =>
                              setNewValueLabel((s) => ({ ...s, [attr.id]: e.target.value }))
                            }
                          />
                          <Input
                            className="h-8 w-24 font-mono text-xs"
                            placeholder="Singk."
                            value={newValueAbbr[attr.id] ?? ""}
                            onChange={(e) =>
                              setNewValueAbbr((s) => ({ ...s, [attr.id]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!newValueLabel[attr.id]?.trim()}
                            onClick={() => {
                              const r = addValue(
                                attr.id,
                                newValueLabel[attr.id] ?? "",
                                newValueAbbr[attr.id],
                              );
                              if (r.ok) {
                                toast.success("Nilai ditambahkan");
                                setNewValueLabel((s) => ({ ...s, [attr.id]: "" }));
                                setNewValueAbbr((s) => ({ ...s, [attr.id]: "" }));
                              } else toast.error(r.error);
                            }}
                          >
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

          <p className="text-[11px] text-muted-foreground mt-4">
            Tip material curah: buat produk terpisah per satuan jual (mis. Pasir Lumajang / Truk vs
            Pasir Lumajang / Pikap) dengan memilih nilai berbeda di attribute Satuan Jual.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

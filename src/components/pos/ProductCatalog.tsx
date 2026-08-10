import { useMemo, useState } from "react";
import { Search, Package2, Plus, Check, Info, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PosCatalogItem } from "@/hooks/usePos";

// -----------------------------------------------------------------------------
// ProductCatalog — search + category filter + product grid (left panel, ~40%).
// -----------------------------------------------------------------------------

export interface ProductCatalogProps {
  catalog: PosCatalogItem[];
  categories: string[];
  isLoading: boolean;
  onAdd: (item: PosCatalogItem, sellUnitId?: string | null, asSoLine?: boolean) => void;
  /** Dipanggil setelah produk berhasil ditambahkan (untuk feedback UI parent). */
  onAdded?: (item: PosCatalogItem) => void;
}

const STOCK_BADGE_CLASS: Record<PosCatalogItem["stockStatus"], string> = {
  critical: "bg-destructive/10 text-destructive",
  low: "bg-warning/15 text-warning-foreground",
  normal: "bg-success/10 text-success",
};

export function ProductCatalog({
  catalog,
  categories,
  isLoading,
  onAdd,
  onAdded,
}: ProductCatalogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("Semua");
  const [addedId, setAddedId] = useState<string | null>(null);
  const [unitPicker, setUnitPicker] = useState<{
    item: PosCatalogItem;
    asSo: boolean;
  } | null>(null);
  const [infoItem, setInfoItem] = useState<PosCatalogItem | null>(null);

  const filtered = useMemo(() => {
    return catalog.filter((p) => {
      if (category !== "Semua" && p.category !== category) return false;
      if (
        search &&
        !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.sku.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [catalog, search, category]);

  const commitAdd = (
    item: PosCatalogItem,
    sellUnitId?: string | null,
    asSoLine = false,
  ) => {
    if (!item.canAddToCart && !asSoLine) return;
    onAdd(item, sellUnitId, asSoLine);
    onAdded?.(item);
    setAddedId(item.branchProductId);
    window.setTimeout(() => setAddedId(null), 650);
  };

  const handleAdd = (item: PosCatalogItem, asSo = false) => {
    if (!asSo && !item.canAddToCart) return;
    if ((item.sellUnits?.length ?? 0) > 1) {
      setUnitPicker({ item, asSo });
      return;
    }
    commitAdd(item, item.sellUnits?.[0]?.id ?? null, asSo);
  };

  return (
    <div className="space-y-4 min-w-0">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau kode produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-11 sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Semua">Semua Kategori</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package2}
          title="Produk tidak ditemukan"
          description="Coba ubah kata kunci pencarian atau filter kategori."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const isJustAdded = addedId === p.branchProductId;
            const outOfStock = !p.canAddToCart;
            return (
              <div
                key={p.branchProductId}
                className={cn(
                  "group relative text-left bg-card border rounded-xl p-3 transition-all",
                  outOfStock
                    ? "opacity-90 border-dashed"
                    : "hover:border-primary hover:shadow-card",
                  isJustAdded &&
                    "border-primary ring-2 ring-primary/40 shadow-glow animate-pos-product-added",
                )}
              >
                {isJustAdded && (
                  <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 z-10 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-success-foreground animate-pos-float-up">
                    +1
                  </span>
                )}

                <div className="absolute top-2 right-2 z-10 flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7 rounded-full shadow-sm"
                    title="Info produk"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setInfoItem(p);
                    }}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => handleAdd(p, false)}
                  disabled={outOfStock}
                  className={cn(
                    "w-full text-left",
                    outOfStock && "cursor-not-allowed",
                  )}
                >
                  <div
                    className={cn(
                      "aspect-square rounded-lg bg-gradient-to-br from-accent to-muted grid place-items-center mb-2 transition-colors relative overflow-hidden",
                      isJustAdded
                        ? "from-success/20 to-success/5"
                        : !outOfStock &&
                            "group-hover:from-primary/10 group-hover:to-primary-glow/10",
                    )}
                  >
                    {isJustAdded ? (
                      <div className="h-10 w-10 rounded-full bg-success text-success-foreground grid place-items-center animate-in zoom-in duration-200">
                        <Check className="h-5 w-5" strokeWidth={3} />
                      </div>
                    ) : (
                      <Package2
                        className={cn(
                          "h-8 w-8 text-muted-foreground/50 transition-colors",
                          !outOfStock && "group-hover:text-primary",
                        )}
                      />
                    )}
                    {!outOfStock && (
                      <div
                        className={cn(
                          "absolute bottom-1.5 right-1.5 h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center transition-all",
                          isJustAdded
                            ? "opacity-100 scale-110"
                            : "opacity-0 group-hover:opacity-100",
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium line-clamp-2 leading-tight pr-6">
                    {p.name}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <div className="text-sm font-bold text-primary">
                      {rupiah(p.sellingPrice, { compact: true })}
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] font-medium",
                        STOCK_BADGE_CLASS[p.stockStatus],
                      )}
                    >
                      {p.stock <= 0
                        ? "Stok 0"
                        : `${p.stock} ${p.stockUnit || p.unit}`}
                    </Badge>
                  </div>
                  {(p.sellUnits?.length ?? 0) > 0 && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {p.sellUnits.length} satuan jual
                    </div>
                  )}
                </button>

                {outOfStock && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-8 w-full gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                    title="Tambah sebagai Sales Order (indent) — tidak potong stok"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAdd(p, true);
                    }}
                  >
                    <Package className="h-3.5 w-3.5" />
                    SO
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {unitPicker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-sm space-y-3 p-4">
            <div>
              <div className="text-sm font-semibold">{unitPicker.item.name}</div>
              <div className="text-xs text-muted-foreground">
                {unitPicker.asSo
                  ? "Pilih satuan · ditambahkan sebagai SO (kirim langsung)"
                  : `Pilih satuan jual · stok ${unitPicker.item.stock} ${unitPicker.item.stockUnit}`}
              </div>
            </div>
            <div className="space-y-2">
              {unitPicker.item.sellUnits.map((u) => {
                const price =
                  u.selling_price != null && u.selling_price > 0
                    ? u.selling_price
                    : unitPicker.item.sellingPrice;
                return (
                  <button
                    key={u.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left hover:border-primary hover:bg-primary/5"
                    onClick={() => {
                      commitAdd(unitPicker.item, u.id, unitPicker.asSo);
                      setUnitPicker(null);
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{u.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        1 {u.label} = {u.factor_to_base} {unitPicker.item.stockUnit}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-base font-bold text-primary">
                        {rupiah(price, { compact: true })}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {rupiah(price)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground"
              onClick={() => setUnitPicker(null)}
            >
              Batal
            </button>
          </Card>
        </div>
      )}

      <Dialog open={!!infoItem} onOpenChange={(o) => !o && setInfoItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Info produk</DialogTitle>
          </DialogHeader>
          {infoItem && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Nama</div>
                <div className="font-medium leading-snug">{infoItem.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">SKU</div>
                  <div className="font-mono text-xs">{infoItem.sku}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Kategori</div>
                  <div>{infoItem.category}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Satuan stok</div>
                  <div>{infoItem.stockUnit || infoItem.unit}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Stok</div>
                  <div>
                    {infoItem.stock} {infoItem.stockUnit || infoItem.unit}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Harga jual</div>
                  <div className="font-semibold text-primary">
                    {rupiah(infoItem.sellingPrice)}
                  </div>
                </div>
              </div>
              {(infoItem.sellUnits?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1.5 text-xs text-muted-foreground">Satuan jual</div>
                  <ul className="space-y-1.5">
                    {infoItem.sellUnits.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs"
                      >
                        <span>
                          {u.label}{" "}
                          <span className="text-muted-foreground">
                            (1 = {u.factor_to_base} {infoItem.stockUnit})
                          </span>
                        </span>
                        <span className="font-medium">
                          {u.selling_price != null && u.selling_price > 0
                            ? rupiah(u.selling_price)
                            : rupiah(infoItem.sellingPrice)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                {infoItem.canAddToCart ? (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      handleAdd(infoItem, false);
                      setInfoItem(null);
                    }}
                  >
                    Tambah ke keranjang
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => {
                      handleAdd(infoItem, true);
                      setInfoItem(null);
                    }}
                  >
                    <Package className="mr-1.5 h-4 w-4" />
                    Tambah sebagai SO
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

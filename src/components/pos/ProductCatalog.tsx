import { useMemo, useState } from "react";
import { Search, Package2, Plus, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  onAdd: (item: PosCatalogItem) => void;
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

  const handleAdd = (item: PosCatalogItem) => {
    if (!item.canAddToCart) return;
    onAdd(item);
    onAdded?.(item);
    setAddedId(item.branchProductId);
    window.setTimeout(() => setAddedId(null), 650);
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
            return (
            <button
              key={p.branchProductId}
              onClick={() => handleAdd(p)}
              disabled={!p.canAddToCart}
              className={cn(
                "group relative text-left bg-card border rounded-xl p-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                "hover:border-primary hover:shadow-card active:scale-[0.98]",
                isJustAdded && "border-primary ring-2 ring-primary/40 shadow-glow animate-pos-product-added",
              )}
            >
              {isJustAdded && (
                <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 z-10 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-success-foreground animate-pos-float-up">
                  +1
                </span>
              )}
              <div
                className={cn(
                  "aspect-square rounded-lg bg-gradient-to-br from-accent to-muted grid place-items-center mb-2 transition-colors relative overflow-hidden",
                  isJustAdded
                    ? "from-success/20 to-success/5"
                    : "group-hover:from-primary/10 group-hover:to-primary-glow/10",
                )}
              >
                {isJustAdded ? (
                  <div className="h-10 w-10 rounded-full bg-success text-success-foreground grid place-items-center animate-in zoom-in duration-200">
                    <Check className="h-5 w-5" strokeWidth={3} />
                  </div>
                ) : (
                  <Package2 className="h-8 w-8 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                )}
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
              </div>
              <div className="text-[11px] text-muted-foreground">{p.sku}</div>
              <div className="text-sm font-medium line-clamp-2 leading-tight mt-0.5">{p.name}</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm font-bold text-primary">
                  {rupiah(p.sellingPrice, { compact: true })}
                </div>
                <Badge
                  variant="secondary"
                  className={cn("text-[10px] font-medium", STOCK_BADGE_CLASS[p.stockStatus])}
                >
                  {p.stock === 0 && p.stockSource !== "verified"
                    ? "Belum verifikasi"
                    : `${p.stock} ${p.unit}`}
                </Badge>
              </div>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { StockStatusFilter } from "@/stores/inventory.store";
import type { Branch } from "@/types/database";

const STATUS_OPTIONS: { id: StockStatusFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "critical", label: "Kritis" },
  { id: "low", label: "Menipis" },
  { id: "normal", label: "Normal" },
  { id: "empty", label: "Habis" },
];

interface ProductFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  statusFilter: StockStatusFilter;
  onStatusChange: (v: StockStatusFilter) => void;
  categoryNames: string[];
  isConsolidated: boolean;
  branchFilter: string;
  onBranchFilterChange: (v: string) => void;
  branches: Branch[];
}

export function ProductFilters({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  categoryNames,
  isConsolidated,
  branchFilter,
  onBranchFilterChange,
  branches,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center p-4 border-b">
      <div className="relative flex-1 min-w-60">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama, SKU, barcode..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <Select value={categoryFilter} onValueChange={onCategoryChange}>
        <SelectTrigger className="h-9 w-48">
          <SelectValue placeholder="Kategori" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Kategori</SelectItem>
          {categoryNames.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex rounded-md border overflow-hidden">
        {STATUS_OPTIONS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onStatusChange(f.id)}
            className={cn(
              "px-3 h-9 text-xs font-medium transition-all whitespace-nowrap",
              statusFilter === f.id
                ? "bg-cyan-600 text-white"
                : "bg-background hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isConsolidated && (
        <Select value={branchFilter} onValueChange={onBranchFilterChange}>
          <SelectTrigger className="h-9 w-52">
            <SelectValue placeholder="Cabang" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Cabang</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { PlatformProductSupplierDialog } from "@/components/platform/PlatformProductSupplierDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPlatformProductSuppliers,
  searchPlatformProductPrices,
} from "@/lib/api/platform";
import { rupiah } from "@/lib/format";
import { requirePlatformAdmin } from "@/routes/platform";
import type { PlatformPriceCompareRow, PlatformProductSupplierPayload } from "@/types/platform";
import { toast } from "sonner";

export const Route = createFileRoute("/platform/price-compare")({
  beforeLoad: () => {
    requirePlatformAdmin();
  },
  head: () => ({
    meta: [{ title: "Banding Harga Toko — Platform" }],
  }),
  component: PlatformPriceComparePage,
});

function PlatformPriceComparePage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PlatformPriceCompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<PlatformPriceCompareRow | null>(null);
  const [supplierPayload, setSupplierPayload] = useState<PlatformProductSupplierPayload | null>(
    null,
  );
  const [supplierLoading, setSupplierLoading] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, PlatformPriceCompareRow[]>();
    for (const row of rows) {
      const key = `${row.sku}::${row.productName}`;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].map(([key, items]) => {
      const prices = items.map((i) => i.sellingPrice);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return { key, name: items[0]?.productName ?? key, sku: items[0]?.sku ?? "", items, min, max };
    });
  }, [rows]);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) {
      toast.error("Ketik minimal 2 huruf (nama, SKU, atau barcode)");
      return;
    }
    setLoading(true);
    const result = await searchPlatformProductPrices(q);
    setLoading(false);
    setSearched(true);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setRows(result.data ?? []);
  };

  const openSupplier = async (row: PlatformPriceCompareRow) => {
    setSelected(row);
    setSupplierPayload(null);
    setSupplierLoading(true);
    const result = await getPlatformProductSuppliers(row.tenantId, row.productId);
    setSupplierLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSupplierPayload(result.data);
  };

  return (
    <PlatformShell
      title="Banding Harga Antar Toko"
      subtitle="Cari barang di semua tenant — klik baris untuk lihat supplier toko itu"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/platform/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </Link>
        </Button>
      }
    >
      <Card className="p-4 mb-6">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Cari nama barang, SKU, atau barcode…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Mencari..." : "Cari"}
          </Button>
        </form>
      </Card>

      {!searched ? (
        <p className="text-sm text-muted-foreground">
          Contoh: semen, besi 10, atau SKU yang sama di beberapa toko.
        </p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada barang yang cocok.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <Card key={group.key} className="overflow-hidden">
              <div className="p-4 border-b flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="font-semibold">{group.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">SKU {group.sku || "—"}</div>
                </div>
                <div className="text-sm">
                  {group.min === group.max ? (
                    <span>{rupiah(group.min)}</span>
                  ) : (
                    <span>
                      {rupiah(group.min)} – {rupiah(group.max)}
                    </span>
                  )}
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Toko</TableHead>
                    <TableHead>Cabang</TableHead>
                    <TableHead className="text-right">Harga jual</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((row) => (
                    <TableRow
                      key={`${row.tenantId}-${row.branchId}-${row.productId}`}
                      className="cursor-pointer"
                      title="Lihat supplier toko ini"
                      tabIndex={0}
                      onClick={() => void openSupplier(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void openSupplier(row);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="font-medium">{row.tenantName}</div>
                        <div className="text-xs text-muted-foreground">/{row.tenantSlug}</div>
                      </TableCell>
                      <TableCell>{row.branchName}</TableCell>
                      <TableCell className="text-right font-medium">
                        {rupiah(row.sellingPrice)}
                        {row.sellingPrice === group.min && group.min !== group.max ? (
                          <span className="ml-2 text-[10px] text-emerald-600">termurah</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.stock} {row.unit}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <ChevronRight className="h-4 w-4 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </div>
      )}
      <PlatformProductSupplierDialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setSupplierPayload(null);
          }
        }}
        loading={supplierLoading}
        sellingPrice={selected?.sellingPrice ?? 0}
        branchName={selected?.branchName ?? "—"}
        payload={supplierPayload}
      />
    </PlatformShell>
  );
}

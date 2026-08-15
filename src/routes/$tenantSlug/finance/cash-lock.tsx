import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { FinanceSubNav } from "@/components/finance/FinanceSubNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventoryCashLock, useCashflowScope } from "@/hooks/useCashflowIntelligence";
import { getCategories } from "@/lib/api/products";
import { queryKeys } from "@/lib/query-keys";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";

export const Route = createFileRoute("/$tenantSlug/finance/cash-lock")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "accountant"]);
  },
  head: () => ({ meta: [{ title: "Cash Lock Stok — SEPS" }] }),
  component: CashLockPage,
});

function bucketLabel(bucket: string) {
  if (bucket === "fast") return "Cepat (<30 hari)";
  if (bucket === "slow") return "Lambat (30–90 hari)";
  return "Mati (>90 hari / belum keluar)";
}

export function CashLockPage() {
  const { tenantId, isMock } = useCashflowScope();
  const [categoryId, setCategoryId] = useState<string>("all");
  const query = useInventoryCashLock(categoryId === "all" ? undefined : categoryId);
  const data = query.data;

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(tenantId),
    queryFn: async () => {
      const result = await getCategories(tenantId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: Boolean(tenantId) && !isMock,
    staleTime: 60_000,
  });

  return (
    <AppShell
      title="Cash Lock Inventory"
      subtitle="Nilai stok yang mengunci kas — berdasarkan harga beli × qty, last outbound (bukan opname)"
    >
      <FinanceSubNav />

      <div className="mb-4 max-w-xs">
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Semua kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            {(categoriesQuery.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isPending ? (
        <LoadingSkeleton variant="card" />
      ) : !data ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Laporan cash lock tersedia setelah data stok Neon terhubung.
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase">Fast mover</div>
              <div className="text-xl font-bold mt-1">
                <CurrencyDisplay value={data.fastValue} compact />
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase">Slow</div>
              <div className="text-xl font-bold mt-1">
                <CurrencyDisplay value={data.slowValue} compact />
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase">Dead stock</div>
              <div className="text-xl font-bold mt-1 text-destructive">
                <CurrencyDisplay value={data.deadValue} compact />
              </div>
            </Card>
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">SKU</th>
                  <th className="p-3">Produk</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3 text-right">Stok</th>
                  <th className="p-3 text-right">Nilai terkunci</th>
                  <th className="p-3">Bucket</th>
                  <th className="p-3">Flag</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.productId} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{row.sku}</td>
                    <td className="p-3">{row.name}</td>
                    <td className="p-3 text-muted-foreground">{row.categoryName ?? "—"}</td>
                    <td className="p-3 text-right">{row.stock}</td>
                    <td className="p-3 text-right">
                      <CurrencyDisplay value={row.lockedValue} compact />
                    </td>
                    <td className="p-3">{bucketLabel(row.bucket)}</td>
                    <td className="p-3">
                      {row.flag === "stop_reorder" && (
                        <Badge variant="destructive">Stop reorder</Badge>
                      )}
                      {row.flag === "kandidat_diskon" && (
                        <Badge variant="secondary">Kandidat diskon</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </AppShell>
  );
}

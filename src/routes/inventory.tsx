import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { PRODUCTS, CATEGORIES, STOCK_MOVEMENTS, stockStatus, type Product } from "@/lib/mock-data";
import { rupiah, angka, tanggal } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Package, AlertTriangle, MapPin, ArrowUp, ArrowDown, FileSpreadsheet, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Simetri ERP" },
      { name: "description", content: "Daftar produk, stok per cabang, dan riwayat mutasi stok." },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!user) navigate({ to: "/login" }); }, [user, navigate]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState<"all" | "critical" | "low">("all");
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  if (!user) return null;

  const filtered = useMemo(() => {
    return PRODUCTS.filter((p) => {
      if (category !== "Semua" && p.category !== category) return false;
      const st = stockStatus(p);
      if (statusFilter === "critical" && st !== "critical") return false;
      if (statusFilter === "low" && st === "normal") return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, category, statusFilter]);

  const totalValue = PRODUCTS.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const criticalCount = PRODUCTS.filter((p) => stockStatus(p) === "critical").length;
  const lowCount = PRODUCTS.filter((p) => stockStatus(p) === "low").length;

  return (
    <AppShell
      title="Inventory"
      subtitle="Kelola produk dan pantau stok di setiap cabang"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => toast.info("Stock opname dimulai")}>
            <ClipboardList className="h-4 w-4 mr-1.5" /> Stock Opname
          </Button>
          <Button size="sm" className="bg-gradient-primary" onClick={() => toast.success("Form tambah produk dibuka")}>
            <Plus className="h-4 w-4 mr-1.5" /> Produk Baru
          </Button>
        </>
      }
    >
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <SummaryCard label="Total SKU" value={`${PRODUCTS.length} produk`} icon={Package} tint="primary" />
        <SummaryCard label="Nilai Stok" value={rupiah(totalValue, { compact: true })} sub={`${PRODUCTS.reduce((s, p) => s + p.stock, 0)} unit total`} icon={Package} tint="info" />
        <SummaryCard label="Stok Kritis" value={`${criticalCount} barang`} icon={AlertTriangle} tint="danger" />
        <SummaryCard label="Stok Menipis" value={`${lowCount} barang`} icon={AlertTriangle} tint="warning" />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari nama atau SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Semua">Semua Kategori</SelectItem>
              {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border overflow-hidden">
            {([
              { id: "all" as const, label: "Semua" },
              { id: "low" as const, label: "Perlu Restock" },
              { id: "critical" as const, label: "Kritis" },
            ]).map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "px-3 h-9 text-xs font-medium transition-all",
                  statusFilter === f.id ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Produk</th>
                <th className="text-left px-4 py-3 font-medium">Kategori</th>
                <th className="text-left px-4 py-3 font-medium">Lokasi</th>
                <th className="text-right px-4 py-3 font-medium">Harga Beli</th>
                <th className="text-right px-4 py-3 font-medium">Harga Jual</th>
                <th className="text-center px-4 py-3 font-medium">Stok</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => {
                const st = stockStatus(p);
                const pct = Math.min(100, (p.stock / (p.minStock * 3)) * 100);
                return (
                  <tr
                    key={p.sku}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => setDetailProduct(p)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        <MapPin className="h-3 w-3 mr-1" />{p.location}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{rupiah(p.costPrice)}</td>
                    <td className="px-4 py-3 text-right font-medium">{rupiah(p.sellPrice)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm font-semibold">{angka(p.stock)} <span className="text-xs font-normal text-muted-foreground">{p.unit}</span></div>
                      <div className="h-1 w-20 mx-auto mt-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            st === "critical" && "bg-destructive",
                            st === "low" && "bg-warning",
                            st === "normal" && "bg-success",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={st} />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Tidak ada produk yang cocok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detailProduct} onOpenChange={(o) => !o && setDetailProduct(null)}>
        <DialogContent className="max-w-2xl">
          {detailProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{detailProduct.name}</DialogTitle>
                <div className="text-xs text-muted-foreground">{detailProduct.sku} · {detailProduct.category}</div>
              </DialogHeader>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Stok Sekarang" value={`${angka(detailProduct.stock)} ${detailProduct.unit}`} />
                <Stat label="Min. Stok" value={`${detailProduct.minStock} ${detailProduct.unit}`} />
                <Stat label="Harga Beli" value={rupiah(detailProduct.costPrice)} />
                <Stat label="Harga Jual" value={rupiah(detailProduct.sellPrice)} accent />
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-3">Riwayat Mutasi Stok</h4>
                <div className="rounded-lg border divide-y max-h-80 overflow-y-auto">
                  {STOCK_MOVEMENTS.filter((m) => m.sku === detailProduct.sku).map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 text-sm">
                      <div className={cn(
                        "h-8 w-8 rounded-full grid place-items-center shrink-0",
                        m.type === "in" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                      )}>
                        {m.type === "in" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{m.note}</div>
                        <div className="text-xs text-muted-foreground">{tanggal(m.date, { withTime: true })} · {m.ref}</div>
                      </div>
                      <div className={cn("font-semibold", m.type === "in" ? "text-success" : "text-destructive")}>
                        {m.type === "in" ? "+" : "−"}{m.qty} {detailProduct.unit}
                      </div>
                    </div>
                  ))}
                  {STOCK_MOVEMENTS.filter((m) => m.sku === detailProduct.sku).length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">Belum ada mutasi stok tercatat</div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SummaryCard({ label, value, sub, icon: Icon, tint }: {
  label: string; value: string; sub?: string;
  icon: typeof Package;
  tint: "primary" | "info" | "danger" | "warning";
}) {
  const grad = { primary: "bg-gradient-primary", info: "bg-gradient-info", danger: "bg-gradient-danger", warning: "bg-gradient-warning" }[tint];
  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase font-medium tracking-wide">{label}</div>
          <div className="text-xl font-bold mt-1">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
        <div className={cn("h-9 w-9 rounded-lg text-white grid place-items-center", grad)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: "normal" | "low" | "critical" }) {
  if (status === "critical") return <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15 border-0">Kritis</Badge>;
  if (status === "low") return <Badge className="bg-warning/20 text-warning-foreground hover:bg-warning/20 border-0">Menipis</Badge>;
  return <Badge className="bg-success/15 text-success hover:bg-success/15 border-0">Normal</Badge>;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="text-[11px] text-muted-foreground uppercase font-medium">{label}</div>
      <div className={cn("text-sm font-bold mt-1", accent && "text-primary")}>{value}</div>
    </div>
  );
}

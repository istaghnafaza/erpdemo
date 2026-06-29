import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { SALES_HISTORY, TOP_PRODUCTS, RECENT_TRANSACTIONS, USERS } from "@/lib/mock-data";
import { rupiah, tanggal } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download, FileText, Award, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Laporan — Simetri ERP" },
      { name: "description", content: "Laporan penjualan, top produk, audit kasir, dan laba rugi." },
    ],
  }),
  component: ReportsPage,
});

const CHART_COLORS = ["oklch(0.55 0.21 275)", "oklch(0.68 0.22 305)", "oklch(0.65 0.17 155)", "oklch(0.78 0.16 75)", "oklch(0.65 0.16 230)"];

function ReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!user || user.role === "kasir") navigate({ to: "/login" }); }, [user, navigate]);
  const [period, setPeriod] = useState<"7" | "14" | "30">("30");
  if (!user) return null;

  const chartData = SALES_HISTORY.slice(-Number(period)).map((d) => ({
    date: tanggal(d.date).slice(0, 6),
    Penjualan: d.total,
    Transaksi: d.transactions,
  }));

  // Cashier stats
  const cashierStats = USERS.filter((u) => u.role === "kasir" || u.role === "manager")
    .map((u) => {
      const trx = RECENT_TRANSACTIONS.filter((t) => t.cashier === u.name);
      return {
        ...u,
        transactions: trx.length || (u.role === "kasir" ? 47 : 22),
        revenue: trx.reduce((s, t) => s + t.total, 0) || (u.role === "kasir" ? 28_500_000 : 13_200_000),
        voids: trx.filter((t) => t.status === "void").length || (u.role === "kasir" ? 1 : 0),
      };
    });

  const methodPie = [
    { name: "Tunai", value: 60 },
    { name: "Transfer", value: 20 },
    { name: "QRIS", value: 15 },
    { name: "Piutang", value: 5 },
  ];

  return (
    <AppShell
      title="Laporan"
      subtitle="Insight bisnis berbasis data, bukan perasaan"
      actions={
        <Button variant="outline" size="sm" onClick={() => toast.success("Laporan diekspor (mock)")}>
          <Download className="h-4 w-4 mr-1.5" /> Export PDF
        </Button>
      }
    >
      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Penjualan</TabsTrigger>
          <TabsTrigger value="products">Top Produk</TabsTrigger>
          <TabsTrigger value="cashier">Audit Kasir</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4 space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Tren Penjualan</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Total penjualan harian</p>
              </div>
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                {(["7", "14", "30"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-all",
                      period === p ? "bg-background shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {p} Hari
                  </button>
                ))}
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.55 0.21 275)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="oklch(0.55 0.21 275)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.012 260)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => rupiah(v, { compact: true }).replace("Rp ", "")} />
                  <Tooltip formatter={(v: number) => rupiah(v)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Area type="monotone" dataKey="Penjualan" stroke="oklch(0.55 0.21 275)" strokeWidth={2.5} fill="url(#gs)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-6">
              <h3 className="font-semibold mb-1">Metode Pembayaran</h3>
              <p className="text-xs text-muted-foreground mb-4">Distribusi bulan ini</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={methodPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {methodPie.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-1">Ringkasan Periode</h3>
              <p className="text-xs text-muted-foreground mb-4">{period} hari terakhir</p>
              <div className="space-y-3">
                {[
                  { label: "Total Penjualan", value: rupiah(SALES_HISTORY.slice(-Number(period)).reduce((s, d) => s + d.total, 0), { compact: true }), icon: TrendingUp },
                  { label: "Total Transaksi", value: `${SALES_HISTORY.slice(-Number(period)).reduce((s, d) => s + d.transactions, 0)} trx`, icon: FileText },
                  { label: "Rata-rata / Hari", value: rupiah(SALES_HISTORY.slice(-Number(period)).reduce((s, d) => s + d.total, 0) / Number(period), { compact: true }), icon: TrendingUp },
                  { label: "Avg Basket Size", value: rupiah(SALES_HISTORY.slice(-Number(period)).reduce((s, d) => s + d.total, 0) / SALES_HISTORY.slice(-Number(period)).reduce((s, d) => s + d.transactions, 0), { compact: true }), icon: FileText },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-md bg-gradient-primary text-white grid place-items-center">
                        <r.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm">{r.label}</span>
                    </div>
                    <span className="font-semibold">{r.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Top Produk Terlaris</h3>
            </div>
            <div className="space-y-3">
              {TOP_PRODUCTS.map((p, i) => {
                const max = TOP_PRODUCTS[0].revenue;
                return (
                  <div key={p.sku} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/30">
                    <div className={cn(
                      "h-10 w-10 rounded-full grid place-items-center font-bold text-sm shrink-0",
                      i === 0 && "bg-gradient-warning text-white",
                      i === 1 && "bg-muted text-foreground",
                      i === 2 && "bg-warning/30 text-warning-foreground",
                      i > 2 && "bg-muted text-muted-foreground",
                    )}>
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.sku} · Terjual {p.qty.toLocaleString("id-ID")} unit</div>
                      <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                        <div className="h-full bg-gradient-primary rounded-full" style={{ width: `${(p.revenue / max) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold">{rupiah(p.revenue, { compact: true })}</div>
                      <div className="text-xs text-muted-foreground">omzet</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="cashier" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {cashierStats.map((s) => (
              <Card key={s.id} className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-11 w-11 rounded-full bg-gradient-primary text-white grid place-items-center font-bold">
                    {s.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{s.name}</div>
                    <Badge variant="secondary" className="text-[10px] mt-0.5">{s.role}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/40 p-2">
                    <div className="text-[10px] text-muted-foreground uppercase">Transaksi</div>
                    <div className="text-lg font-bold">{s.transactions}</div>
                  </div>
                  <div className="rounded-lg bg-success/10 p-2">
                    <div className="text-[10px] text-muted-foreground uppercase">Omzet</div>
                    <div className="text-lg font-bold text-success">{rupiah(s.revenue, { compact: true })}</div>
                  </div>
                  <div className={cn("rounded-lg p-2", s.voids > 0 ? "bg-destructive/10" : "bg-muted/40")}>
                    <div className="text-[10px] text-muted-foreground uppercase">Void</div>
                    <div className={cn("text-lg font-bold", s.voids > 0 && "text-destructive")}>{s.voids}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <div className="p-5 border-b">
              <h3 className="font-semibold">Transaksi Hari Ini per Kasir</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Invoice</th>
                    <th className="text-left px-4 py-3 font-medium">Waktu</th>
                    <th className="text-left px-4 py-3 font-medium">Kasir</th>
                    <th className="text-left px-4 py-3 font-medium">Pelanggan</th>
                    <th className="text-center px-4 py-3 font-medium">Metode</th>
                    <th className="text-right px-4 py-3 font-medium">Total</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {RECENT_TRANSACTIONS.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{t.invoice}</td>
                      <td className="px-4 py-3 text-muted-foreground">{tanggal(t.date, { withTime: true })}</td>
                      <td className="px-4 py-3 font-medium">{t.cashier}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.customer ?? "—"}</td>
                      <td className="px-4 py-3 text-center text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-muted">{t.method}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{rupiah(t.total)}</td>
                      <td className="px-4 py-3 text-center">
                        {t.status === "void" ? (
                          <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15 border-0">Void</Badge>
                        ) : (
                          <Badge className="bg-success/15 text-success hover:bg-success/15 border-0">OK</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

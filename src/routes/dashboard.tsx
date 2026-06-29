import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import {
  FINANCE_SUMMARY, SALES_HISTORY, TOP_PRODUCTS, PRODUCTS, RECEIVABLES,
  RECENT_TRANSACTIONS, CUSTOMERS, stockStatus,
} from "@/lib/mock-data";
import { rupiah, angka, tanggal, daysBetween } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, Receipt, Wallet, Package,
  ArrowUpRight, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Simetri ERP" },
      { name: "description", content: "Ringkasan harian: penjualan, stok kritis, piutang, dan kas dalam satu layar." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"7d" | "30d">("30d");

  useEffect(() => {
    if (!user) navigate({ to: "/login" });
    else if (user.role === "kasir") navigate({ to: "/pos" });
  }, [user, navigate]);

  if (!user) return null;

  const todaySales = SALES_HISTORY[SALES_HISTORY.length - 1].total;
  const yesterdaySales = SALES_HISTORY[SALES_HISTORY.length - 2].total;
  const salesDelta = ((todaySales - yesterdaySales) / yesterdaySales) * 100;

  const criticalProducts = PRODUCTS.filter((p) => stockStatus(p) === "critical");
  const lowProducts = PRODUCTS.filter((p) => stockStatus(p) === "low");

  const overdueReceivables = RECEIVABLES
    .filter((r) => r.amount - r.paid > 0 && daysBetween(new Date().toISOString(), r.dueDate) > 0)
    .sort((a, b) => daysBetween(new Date().toISOString(), b.dueDate) - daysBetween(new Date().toISOString(), a.dueDate));

  const chartData = SALES_HISTORY.slice(period === "7d" ? -7 : -30).map((d) => ({
    date: tanggal(d.date).slice(0, 6),
    Penjualan: d.total,
    Transaksi: d.transactions,
  }));

  return (
    <AppShell
      title={`Halo, ${user.name.split(" ")[0]} 👋`}
      subtitle={`Ringkasan toko hari ini, ${tanggal(new Date().toISOString(), { full: true })}`}
    >
      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Penjualan Hari Ini"
          value={rupiah(todaySales, { compact: true })}
          sub={`${RECENT_TRANSACTIONS.filter((t) => daysBetween(new Date().toISOString(), t.date) === 0).length} transaksi`}
          delta={salesDelta}
          icon={Wallet}
          gradient="primary"
        />
        <KpiCard
          label="Stok Kritis"
          value={`${criticalProducts.length} barang`}
          sub={`${lowProducts.length} barang menipis`}
          icon={Package}
          gradient="danger"
          alert={criticalProducts.length > 0}
        />
        <KpiCard
          label="Piutang Jatuh Tempo"
          value={rupiah(overdueReceivables.reduce((s, r) => s + (r.amount - r.paid), 0), { compact: true })}
          sub={`${overdueReceivables.length} invoice terlambat`}
          icon={Receipt}
          gradient="warning"
          alert={overdueReceivables.length > 0}
        />
        <KpiCard
          label="Laba Bersih Bulan Ini"
          value={rupiah(FINANCE_SUMMARY.monthNetProfit, { compact: true })}
          sub={`Margin ${Math.round((FINANCE_SUMMARY.monthNetProfit / FINANCE_SUMMARY.monthSales) * 100)}%`}
          delta={12.4}
          icon={TrendingUp}
          gradient="success"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3 mt-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold">Tren Penjualan</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Total {period === "7d" ? "7" : "30"} hari terakhir
              </p>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["7d", "30d"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    period === p ? "bg-background shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {p === "7d" ? "7 Hari" : "30 Hari"}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -10, right: 0, top: 10 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.55 0.21 275)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.55 0.21 275)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.012 260)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="oklch(0.5 0.03 260)" />
                <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.5 0.03 260)" tickFormatter={(v) => rupiah(v, { compact: true }).replace("Rp ", "")} />
                <Tooltip
                  formatter={(v: number) => rupiah(v)}
                  labelClassName="text-xs"
                  contentStyle={{ borderRadius: 10, border: "1px solid oklch(0.92 0.012 260)", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="Penjualan" stroke="oklch(0.55 0.21 275)" strokeWidth={2.5} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold">Top 5 Terlaris</h3>
              <p className="text-xs text-muted-foreground mt-1">Bulan ini</p>
            </div>
          </div>
          <div className="space-y-3">
            {TOP_PRODUCTS.map((p, i) => {
              const max = TOP_PRODUCTS[0].revenue;
              const pct = (p.revenue / max) * 100;
              return (
                <div key={p.sku}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium truncate flex-1">
                      <span className="text-muted-foreground mr-1.5">#{i + 1}</span>
                      {p.name}
                    </span>
                    <span className="text-muted-foreground ml-2">{rupiah(p.revenue, { compact: true })}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Alerts + transactions */}
      <div className="grid gap-4 lg:grid-cols-2 mt-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 grid place-items-center">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <h3 className="font-semibold">Perlu Perhatian</h3>
            </div>
            <Link to="/inventory" className="text-xs text-primary hover:underline flex items-center gap-1">
              Lihat semua <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {criticalProducts.slice(0, 2).map((p) => (
              <div key={p.sku} className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                <div className="h-9 w-9 rounded-lg bg-destructive/15 grid place-items-center shrink-0">
                  <Package className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Sisa <span className="text-destructive font-semibold">{p.stock} {p.unit}</span> · Min {p.minStock}
                  </div>
                </div>
                <Badge variant="destructive" className="text-[10px]">KRITIS</Badge>
              </div>
            ))}
            {overdueReceivables.slice(0, 2).map((r) => {
              const c = CUSTOMERS.find((x) => x.id === r.customerId)!;
              const daysLate = daysBetween(new Date().toISOString(), r.dueDate);
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <div className="h-9 w-9 rounded-lg bg-warning/20 grid place-items-center shrink-0">
                    <Clock className="h-4 w-4 text-warning-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {rupiah(r.amount - r.paid)} · <span className="text-destructive">terlambat {daysLate} hari</span>
                    </div>
                  </div>
                  <Badge className="text-[10px] bg-warning text-warning-foreground hover:bg-warning">JATUH TEMPO</Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Transaksi Terbaru</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Hari ini</p>
            </div>
            <Link to="/reports" className="text-xs text-primary hover:underline flex items-center gap-1">
              Audit kasir <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {RECENT_TRANSACTIONS.filter((t) => daysBetween(new Date().toISOString(), t.date) === 0).slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.invoice}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.cashier} · {t.items} item · <PaymentBadge method={t.method} />
                  </div>
                </div>
                <div className="text-sm font-semibold ml-3">{rupiah(t.total, { compact: true })}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Finance snapshot */}
      <Card className="p-6 mt-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold">Ringkasan Keuangan Bulan Ini</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Update real-time</p>
          </div>
          <Link to="/finance">
            <Button variant="outline" size="sm">Lihat Detail</Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Penjualan", value: FINANCE_SUMMARY.monthSales },
            { label: "HPP", value: FINANCE_SUMMARY.monthCogs },
            { label: "Laba Kotor", value: FINANCE_SUMMARY.monthGrossProfit, accent: "info" },
            { label: "Operasional", value: FINANCE_SUMMARY.monthOpex },
            { label: "Laba Bersih", value: FINANCE_SUMMARY.monthNetProfit, accent: "success" },
          ].map((m) => (
            <div key={m.label}>
              <div className="text-xs text-muted-foreground">{m.label}</div>
              <div
                className={cn(
                  "text-lg font-bold mt-1",
                  m.accent === "success" && "text-success",
                  m.accent === "info" && "text-info",
                )}
              >
                {rupiah(m.value, { compact: true })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 h-2 rounded-full bg-muted overflow-hidden flex">
          <div style={{ width: `${(FINANCE_SUMMARY.monthCogs / FINANCE_SUMMARY.monthSales) * 100}%` }} className="bg-muted-foreground/40" />
          <div style={{ width: `${(FINANCE_SUMMARY.monthOpex / FINANCE_SUMMARY.monthSales) * 100}%` }} className="bg-warning" />
          <div style={{ width: `${(FINANCE_SUMMARY.monthNetProfit / FINANCE_SUMMARY.monthSales) * 100}%` }} className="bg-gradient-success" />
        </div>
        <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-muted-foreground/40" />HPP</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-warning" />Operasional</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" />Laba Bersih</span>
        </div>
      </Card>
    </AppShell>
  );
}

function KpiCard({
  label, value, sub, delta, icon: Icon, gradient, alert,
}: {
  label: string; value: string; sub?: string; delta?: number;
  icon: typeof TrendingUp;
  gradient: "primary" | "success" | "warning" | "danger";
  alert?: boolean;
}) {
  const grad = {
    primary: "bg-gradient-primary",
    success: "bg-gradient-success",
    warning: "bg-gradient-warning",
    danger: "bg-gradient-danger",
  }[gradient];

  return (
    <Card className={cn("p-5 relative overflow-hidden shadow-card", alert && "ring-1 ring-destructive/30")}>
      <div className="flex items-start justify-between">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
        <div className={cn("h-9 w-9 rounded-xl grid place-items-center text-white", grad)}>
          <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </div>
      </div>
      <div className="text-2xl font-bold mt-3 tracking-tight">{value}</div>
      <div className="flex items-center justify-between mt-1">
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        {delta !== undefined && (
          <div className={cn("text-xs font-medium flex items-center gap-0.5", delta >= 0 ? "text-success" : "text-destructive")}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </div>
    </Card>
  );
}

function PaymentBadge({ method }: { method: string }) {
  const map: Record<string, string> = {
    Tunai: "text-success",
    QRIS: "text-info",
    Transfer: "text-primary",
    Piutang: "text-warning-foreground",
  };
  return <span className={cn("font-medium", map[method])}>{method}</span>;
}

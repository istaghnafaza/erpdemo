import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Award } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ExportReportButtons } from "@/components/reports/ExportReportButtons";
import { ReportScopeBadge } from "@/components/reports/ReportScopeBadge";
import { ReportsSubNav } from "@/components/reports/ReportsSubNav";
import { Card } from "@/components/ui/card";
import { useReports } from "@/hooks/useReports";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FileText, TrendingUp } from "lucide-react";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";

export const Route = createFileRoute("/$tenantSlug/reports/sales")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "accountant"]);
  },
  head: () => ({ meta: [{ title: "Laporan Penjualan — SEPS" }] }),
  component: SalesReportPage,
});

const CHART_COLORS = [
  "oklch(0.55 0.21 275)",
  "oklch(0.68 0.22 305)",
  "oklch(0.65 0.17 155)",
  "oklch(0.78 0.16 75)",
];

function SalesReportPage() {
  const {
    user,
    period,
    setPeriod,
    scopeLabel,
    isConsolidated,
    salesReport,
    paymentMethods,
    topProducts,
  } = useReports("30");

  if (!user) return null;

  return (
    <AppShell
      title="Laporan Penjualan"
      subtitle={
        isConsolidated
          ? "Analisis penjualan gabungan semua cabang"
          : `Analisis penjualan cabang ${scopeLabel}`
      }
      actions={<ExportReportButtons reportName="Laporan Penjualan" />}
    >
      <ReportsSubNav />

      <div className="mb-4">
        <ReportScopeBadge scopeLabel={scopeLabel} isConsolidated={isConsolidated} />
      </div>

      <Card className="p-6 mb-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="font-semibold">Tren Penjualan</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Total penjualan harian</p>
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(["7", "14", "30"] as const).map((p) => (
              <button
                key={p}
                type="button"
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
            <AreaChart data={salesReport.chart}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.55 0.21 275)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="oklch(0.55 0.21 275)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.012 260)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => rupiah(v, { compact: true }).replace("Rp ", "")}
              />
              <Tooltip formatter={(v: number) => rupiah(v)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="total"
                name="Penjualan"
                stroke="oklch(0.55 0.21 275)"
                strokeWidth={2.5}
                fill="url(#salesGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <Card className="p-6">
          <h3 className="font-semibold mb-1">Metode Pembayaran</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribusi periode</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethods}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {paymentMethods.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
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
              {
                label: "Total Penjualan",
                value: rupiah(salesReport.summary.totalSales, { compact: true }),
                icon: TrendingUp,
              },
              {
                label: "Total Transaksi",
                value: `${salesReport.summary.totalTransactions} trx`,
                icon: FileText,
              },
              {
                label: "Rata-rata Transaksi",
                value: rupiah(salesReport.summary.avgTicket),
                icon: TrendingUp,
              },
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

      <Card>
        <div className="p-5 border-b">
          <h3 className="font-semibold">Tabel Penjualan Harian</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                <th className="text-right px-4 py-3 font-medium">Penjualan</th>
                <th className="text-right px-4 py-3 font-medium">Transaksi</th>
                <th className="text-right px-4 py-3 font-medium">Rata-rata</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...salesReport.chart].reverse().map((row) => (
                <tr key={row.date} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{row.label}</td>
                  <td className="px-4 py-3 text-right font-medium">{rupiah(row.total)}</td>
                  <td className="px-4 py-3 text-right">{row.transactions}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {rupiah(row.transactions > 0 ? Math.round(row.total / row.transactions) : 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Top Produk Terlaris</h3>
        </div>
        <div className="space-y-3">
          {topProducts.map((p, i) => {
            const max = topProducts[0]?.revenue ?? 1;
            return (
              <div
                key={p.sku}
                className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/30"
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-full grid place-items-center font-bold text-sm shrink-0",
                    i === 0 && "bg-gradient-warning text-white",
                    i === 1 && "bg-muted text-foreground",
                    i === 2 && "bg-warning/30 text-warning-foreground",
                    i > 2 && "bg-muted text-muted-foreground",
                  )}
                >
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.sku} · Terjual {p.qty.toLocaleString("id-ID")} unit
                  </div>
                  <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-primary rounded-full"
                      style={{ width: `${(p.revenue / max) * 100}%` }}
                    />
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
    </AppShell>
  );
}

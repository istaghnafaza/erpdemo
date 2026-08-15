import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { DashboardKpiSettingsDialog } from "@/components/dashboard/DashboardKpiSettingsDialog";
import {
  DashboardKpiDetailDialog,
  type DashboardKpiDetailData,
} from "@/components/dashboard/DashboardKpiDetailDialog";
import { useAuthStore } from "@/stores/auth.store";
import { useNotificationStore } from "@/stores/notification.store";
import {
  useDashboardPreferencesStore,
  type DashboardKpiId,
} from "@/stores/dashboard-preferences.store";
import {
  entityRoute,
  NOTIFICATION_TYPE_CONFIG,
} from "@/components/layout/NotificationPanel";
import { useDashboard, type DashboardPeriod } from "@/hooks/useDashboard";
import { rupiah, tanggal } from "@/lib/format";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Bell,
  Wallet,
  Package,
  Receipt,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  PiggyBank,
  Scale,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { requireAuth } from "@/routes/$tenantSlug";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import type { TopProduct } from "@/types/app";

export const Route = createFileRoute("/$tenantSlug/dashboard")({
  beforeLoad: () => {
    requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Dashboard — SEPS" },
      {
        name: "description",
        content: "Ringkasan harian: penjualan, stok kritis, piutang, dan kas dalam satu layar.",
      },
    ],
  }),
  component: DashboardPage,
});

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "today", label: "Hari Ini" },
  { value: "week", label: "Minggu Ini" },
  { value: "month", label: "Bulan Ini" },
];

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 11) return "Pagi";
  if (h < 15) return "Siang";
  if (h < 19) return "Sore";
  return "Malam";
}

function DashboardPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const navigate = useNavigate();
  const { tenantSlug } = useParams({ from: "/$tenantSlug/dashboard" });
  const openNotifPanel = useNotificationStore((s) => s.openPanel);
  const markNotifRead = useNotificationStore((s) => s.markRead);
  const isKpiVisible = useDashboardPreferencesStore((s) => s.isKpiVisible);
  const [detailKpiId, setDetailKpiId] = useState<DashboardKpiId | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openKpiDetail = (id: DashboardKpiId) => {
    setDetailKpiId(id);
    setDetailOpen(true);
  };

  const {
    user,
    isOwner,
    isConsolidated,
    isLoading,
    period,
    setPeriod,
    periodSales,
    periodProfit,
    criticalProducts,
    lowStockProducts,
    criticalStockCount,
    lowStockCount,
    overdueTotal,
    overdueCustomerCount,
    totalCashBalance,
    cashAccountCount,
    salesChartData,
    topProducts,
    topProfitableToday,
    financeSummary,
    cashflowKpis,
    recentNotifications,
    branches,
    branchSummaries,
    branchSummaryTotals,
    setActiveBranch,
  } = useDashboard();

  const topProductsChart = useMemo(() => {
    if (!topProducts.length) return [];
    const first = topProducts[0] as { name?: string; productName?: string; revenue?: number; totalRevenue?: number };
    if ("productName" in first && first.productName) {
      return (topProducts as TopProduct[]).slice(0, 5).map((p) => ({
        name: p.productName,
        revenue: p.totalRevenue,
      }));
    }
    return (topProducts as { name: string; revenue: number }[]).slice(0, 5);
  }, [topProducts]);

  useEffect(() => {
    if (!user) navigate({ to: "/login" });
    else if (user.role === "cashier") navigate({ to: "/$tenantSlug/pos", params: { tenantSlug } });
  }, [user, navigate, tenantSlug]);

  if (!user) return null;

  const kpiDetailData: DashboardKpiDetailData = {
    period,
    periodLabel: periodSales.label,
    sales: {
      total: periodSales.total,
      transactions: periodSales.transactions,
      marginPct: periodProfit.grossMarginPct,
      compareLabel: periodSales.compareLabel,
      deltaPct: periodSales.deltaPct,
    },
    profit: {
      grossProfit: periodProfit.grossProfit,
      netProfit: periodProfit.netProfit,
      opex: periodProfit.opex,
      marginPct: periodProfit.grossMarginPct,
      compareLabel: periodProfit.compareLabel,
      deltaGrossPct: periodProfit.deltaGrossPct,
      deltaNetPct: periodProfit.deltaNetPct,
    },
    stock: {
      criticalCount: criticalStockCount,
      lowCount: lowStockCount,
    },
    receivables: {
      overdueTotal,
      customerCount: overdueCustomerCount,
    },
    cash: {
      totalBalance: totalCashBalance,
      accountCount: cashAccountCount,
    },
  };

  const kpiCards: { id: DashboardKpiId; node: ReactNode }[] = [
    {
      id: "sales",
      node: (
        <KpiCard
          key="sales"
          label={`Penjualan ${periodSales.label}`}
          value={<CurrencyDisplay value={periodSales.total} compact />}
          sub={`${periodSales.transactions} transaksi · Margin rata-rata ${periodProfit.grossMarginPct}%`}
          delta={periodSales.deltaPct}
          compareLabel={periodSales.compareLabel}
          icon={Wallet}
          gradient="primary"
          onClick={() => openKpiDetail("sales")}
        />
      ),
    },
    {
      id: "gross_profit",
      node: (
        <KpiCard
          key="gross_profit"
          label={`Keuntungan ${periodProfit.label}`}
          value={<CurrencyDisplay value={periodProfit.grossProfit} compact />}
          sub={`Margin ${periodProfit.grossMarginPct}% dari penjualan`}
          delta={periodProfit.deltaGrossPct}
          compareLabel={periodProfit.compareLabel}
          icon={TrendingUp}
          gradient="info"
          onClick={() => openKpiDetail("gross_profit")}
        />
      ),
    },
    {
      id: "net_profit",
      node: (
        <KpiCard
          key="net_profit"
          label={`Laba Bersih ${periodProfit.label}`}
          value={<CurrencyDisplay value={periodProfit.netProfit} compact />}
          sub="Setelah biaya operasional"
          delta={periodProfit.deltaNetPct}
          compareLabel={periodProfit.compareLabel}
          icon={PiggyBank}
          gradient="success"
          onClick={() => openKpiDetail("net_profit")}
        />
      ),
    },
    {
      id: "critical_stock",
      node: (
        <KpiCard
          key="critical_stock"
          label="Produk Stok Kritis"
          value={`${criticalStockCount} produk`}
          sub={`${lowStockCount} produk menipis`}
          icon={Package}
          gradient="danger"
          alert={criticalStockCount > 0}
          cta={{ label: "Lihat", to: "/$tenantSlug/inventory", params: { tenantSlug } }}
          onClick={() => openKpiDetail("critical_stock")}
        />
      ),
    },
    {
      id: "overdue_ar",
      node: (
        <KpiCard
          key="overdue_ar"
          label="Piutang Jatuh Tempo"
          value={<CurrencyDisplay value={overdueTotal} compact />}
          sub={`${overdueCustomerCount} pelanggan`}
          icon={Receipt}
          gradient="warning"
          alert={overdueTotal > 0}
          cta={{ label: "Lihat", to: "/$tenantSlug/receivables", params: { tenantSlug } }}
          onClick={() => openKpiDetail("overdue_ar")}
        />
      ),
    },
    {
      id: "cash_balance",
      node: (
        <KpiCard
          key="cash_balance"
          label="Saldo Kas & Bank"
          value={<CurrencyDisplay value={totalCashBalance} compact />}
          sub={`${cashAccountCount} akun kas & bank`}
          icon={Wallet}
          gradient="info"
          onClick={() => openKpiDetail("cash_balance")}
        />
      ),
    },
    {
      id: "cash_vs_profit",
      node: (
        <KpiCard
          key="cash_vs_profit"
          label="Kas vs Laba"
          value={<CurrencyDisplay value={cashflowKpis?.kasRiil ?? totalCashBalance} compact />}
          sub={`Laba ${new Intl.NumberFormat("id-ID", { notation: "compact" }).format(cashflowKpis?.labaNet ?? periodProfit.netProfit)} · Piutang ${new Intl.NumberFormat("id-ID", { notation: "compact" }).format(cashflowKpis?.openArTotal ?? 0)}`}
          icon={Scale}
          gradient="info"
          cta={{ label: "Keuangan", to: "/$tenantSlug/finance", params: { tenantSlug } }}
          onClick={() => openKpiDetail("cash_vs_profit")}
        />
      ),
    },
    {
      id: "cash_forecast",
      node: (
        <KpiCard
          key="cash_forecast"
          label="Proyeksi Kas 30 Hari"
          value={<CurrencyDisplay value={cashflowKpis?.forecastEnd30 ?? totalCashBalance} compact />}
          sub={
            cashflowKpis?.forecastGoesNegative
              ? `Peringatan: saldo negatif ${cashflowKpis.firstNegativeDate ?? ""}`
              : "Tidak ada peringatan saldo negatif"
          }
          icon={TrendingDown}
          gradient={cashflowKpis?.forecastGoesNegative ? "danger" : "success"}
          alert={Boolean(cashflowKpis?.forecastGoesNegative)}
          cta={{ label: "Forecast", to: "/$tenantSlug/finance/forecast", params: { tenantSlug } }}
          onClick={() => openKpiDetail("cash_forecast")}
        />
      ),
    },
    {
      id: "cash_lock_stock",
      node: (
        <KpiCard
          key="cash_lock_stock"
          label="Stok Lambat / Mati"
          value={<CurrencyDisplay value={(cashflowKpis?.deadStockValue ?? 0) + (cashflowKpis?.slowStockValue ?? 0)} compact />}
          sub={`Mati ${new Intl.NumberFormat("id-ID", { notation: "compact" }).format(cashflowKpis?.deadStockValue ?? 0)} · Lambat ${new Intl.NumberFormat("id-ID", { notation: "compact" }).format(cashflowKpis?.slowStockValue ?? 0)}`}
          icon={Package}
          gradient="warning"
          alert={(cashflowKpis?.deadStockValue ?? 0) > 0}
          cta={{ label: "Cash lock", to: "/$tenantSlug/finance/cash-lock", params: { tenantSlug } }}
          onClick={() => openKpiDetail("cash_lock_stock")}
        />
      ),
    },
    {
      id: "ar_ap_due",
      node: (
        <KpiCard
          key="ar_ap_due"
          label="AR vs AP 30 Hari"
          value={<CurrencyDisplay value={cashflowKpis?.arDue30 ?? overdueTotal} compact />}
          sub={`Piutang vs hutang jatuh tempo 30 hari: ${new Intl.NumberFormat("id-ID", { notation: "compact" }).format(cashflowKpis?.apDue30 ?? 0)} AP`}
          icon={Receipt}
          gradient="warning"
          cta={{ label: "Piutang", to: "/$tenantSlug/receivables", params: { tenantSlug } }}
          onClick={() => openKpiDetail("ar_ap_due")}
        />
      ),
    },
  ];

  const visibleKpiCards = kpiCards.filter((k) => isOwner ? isKpiVisible(k.id) : true);

  const handleNotifClick = (id: string, notif: (typeof recentNotifications)[number]) => {
    markNotifRead(id);
    const route = entityRoute(notif, tenantSlug);
    if (route) navigate({ to: route });
  };

  return (
    <AppShell
      title={`Selamat ${greetingWord()}, ${user.name.split(" ")[0]}! 👋`}
      subtitle={`Ringkasan toko hari ini, ${tanggal(new Date().toISOString(), { full: true })}`}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {isOwner && <DashboardKpiSettingsDialog />}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  period === opt.value
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {cashflowKpis?.forecastGoesNegative && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm">
              Proyeksi kas 30 hari menyentuh saldo negatif mulai{" "}
              <strong>{cashflowKpis.firstNegativeDate}</strong>.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/$tenantSlug/finance/forecast" params={{ tenantSlug }}>
              Lihat forecast
            </Link>
          </Button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: Math.max(visibleKpiCards.length, 3) }).map((_, i) => (
            <LoadingSkeleton key={i} variant="kpi" />
          ))
        ) : (
          visibleKpiCards.map((k) => k.node)
        )}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3 mt-6">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4">
            <h3 className="font-semibold">Tren Penjualan</h3>
            <p className="text-xs text-muted-foreground mt-1">30 hari terakhir</p>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesChartData} margin={{ left: -10, right: 8, top: 10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(0.92 0.012 260)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="oklch(0.5 0.03 260)"
                    tickFormatter={(v: string) => tanggal(v).slice(0, 6)}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="oklch(0.5 0.03 260)"
                    tickFormatter={(v) => rupiah(v, { compact: true }).replace("Rp ", "")}
                  />
                  <Tooltip
                    labelFormatter={(v: string) => tanggal(v, { full: true })}
                    formatter={(v: number, name: string) =>
                      name === "Penjualan" ? [rupiah(v), "Penjualan"] : [v, "Transaksi"]
                    }
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid oklch(0.92 0.012 260)",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Penjualan"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="font-semibold">Top 5 Terlaris</h3>
              <p className="text-xs text-muted-foreground mt-1">30 hari terakhir · by omzet</p>
            </div>
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : topProductsChart.length === 0 ? (
              <EmptyState icon={Package} title="Belum ada penjualan" />
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProductsChart}
                    layout="vertical"
                    margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="topProductsGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={96}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                      stroke="oklch(0.5 0.03 260)"
                    />
                    <Tooltip
                      formatter={(v: number) => [rupiah(v), "Omzet"]}
                      cursor={{ fill: "oklch(0.96 0.005 260)" }}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid oklch(0.92 0.012 260)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="url(#topProductsGradient)"
                      radius={[0, 6, 6, 0]}
                      barSize={14}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h3 className="font-semibold">Top 5 Paling Menguntungkan</h3>
              <p className="text-xs text-muted-foreground mt-1">Hari ini · by keuntungan</p>
            </div>
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : topProfitableToday.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Belum ada keuntungan hari ini" />
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProfitableToday}
                    layout="vertical"
                    margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="topProfitGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#16a34a" />
                        <stop offset="100%" stopColor="#4ade80" />
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={96}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                      stroke="oklch(0.5 0.03 260)"
                    />
                    <Tooltip
                      formatter={(v: number) => [rupiah(v), "Keuntungan"]}
                      cursor={{ fill: "oklch(0.96 0.005 260)" }}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid oklch(0.92 0.012 260)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="profit"
                      fill="url(#topProfitGradient)"
                      radius={[0, 6, 6, 0]}
                      barSize={14}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Notifikasi + Ringkasan Keuangan */}
      <div className="grid gap-4 lg:grid-cols-2 mt-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 grid place-items-center">
                <Bell className="h-4 w-4 text-destructive" />
              </div>
              <h3 className="font-semibold">Notifikasi Aktif</h3>
            </div>
            <button
              onClick={() => openNotifPanel()}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Lihat semua <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          {isLoading ? (
            <LoadingSkeleton variant="avatar-line" count={4} className="space-y-3" />
          ) : recentNotifications.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Tidak ada notifikasi aktif"
              description="Stok, piutang, dan hutang toko dalam kondisi aman."
            />
          ) : (
            <div className="space-y-1">
              {recentNotifications.map((n) => {
                const cfg = NOTIFICATION_TYPE_CONFIG[n.type];
                const Icon = cfg.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n.id, n)}
                    className={cn(
                      "w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors",
                      !n.isRead && "bg-primary/[0.03]",
                    )}
                  >
                    <div
                      className={cn(
                        "h-9 w-9 rounded-lg grid place-items-center shrink-0",
                        cfg.iconClass,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{n.title}</span>
                        {!n.isRead && (
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground/70 shrink-0">
                      {tanggal(n.createdAt, { withTime: true })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold">Ringkasan Keuangan Bulan Ini</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Update real-time</p>
            </div>
            <Link to="/$tenantSlug/finance" params={{ tenantSlug }}>
              <Button variant="outline" size="sm">
                Lihat Laporan Lengkap
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <LoadingSkeleton variant="text" count={5} />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: "Penjualan", value: financeSummary.monthSales },
                  { label: "Margin Keuntungan", value: financeSummary.monthSalesMargin, accent: "info" as const },
                  { label: "Operasional", value: financeSummary.monthOpex },
                  {
                    label: "Laba Bersih",
                    value: financeSummary.monthNetProfit,
                    accent: "success" as const,
                    highlight: true,
                  },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <CurrencyDisplay
                      value={m.value}
                      compact
                      className={cn(
                        "block font-bold mt-1",
                        m.highlight ? "text-2xl text-success" : "text-lg",
                        !m.highlight && m.accent === "info" && "text-info",
                      )}
                    />
                    {m.label === "Margin Keuntungan" && financeSummary.monthSales > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Margin{" "}
                        {Math.round(
                          (financeSummary.monthSalesMargin / financeSummary.monthSales) * 100,
                        )}
                        %
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {financeSummary.monthSales > 0 && (
              <div className="mt-5 h-2 rounded-full bg-muted overflow-hidden flex">
                <div
                  style={{
                    width: `${((financeSummary.monthSales - financeSummary.monthSalesMargin) / financeSummary.monthSales) * 100}%`,
                  }}
                  className="bg-muted-foreground/40"
                />
                <div
                  style={{
                    width: `${(financeSummary.monthOpex / financeSummary.monthSales) * 100}%`,
                  }}
                  className="bg-warning"
                />
                <div
                  style={{
                    width: `${(financeSummary.monthNetProfit / financeSummary.monthSales) * 100}%`,
                  }}
                  className="bg-gradient-success"
                />
              </div>
              )}
              <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-muted-foreground/40" />
                  Biaya Beli
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-warning" />
                  Operasional
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-success" />
                  Laba Bersih
                </span>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Mode konsolidasi — khusus owner saat "Semua Cabang" dipilih */}
      {isOwner && isConsolidated && (
        <Card className="p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Ringkasan Semua Cabang</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Penjualan & keuntungan {periodSales.label.toLowerCase()} · klik baris untuk beralih cabang
              </p>
            </div>
          </div>

          {isLoading ? (
            <LoadingSkeleton variant="table-row" count={branches.length || 3} />
          ) : branchSummaries.length === 0 ? (
            <EmptyState icon={Layers} title="Belum ada data cabang" />
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left font-medium py-2 px-2">Cabang</th>
                    <th className="text-right font-medium py-2 px-2">Penjualan</th>
                    <th className="text-right font-medium py-2 px-2">Keuntungan</th>
                    <th className="text-right font-medium py-2 px-2">Laba Bersih</th>
                    <th className="text-right font-medium py-2 px-2">Margin</th>
                    <th className="text-right font-medium py-2 px-2">Transaksi</th>
                    <th className="text-right font-medium py-2 px-2">Stok Kritis</th>
                  </tr>
                </thead>
                <tbody>
                  {branchSummaries.map((row) => {
                    const branch = branches.find((b) => b.id === row.branchId);
                    return (
                      <tr
                        key={row.branchId}
                        onClick={() => branch && setActiveBranch(branch)}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-2.5 px-2 font-medium">{row.branchName}</td>
                        <td className="py-2.5 px-2 text-right">
                          <CurrencyDisplay value={row.revenue} compact />
                        </td>
                        <td className="py-2.5 px-2 text-right text-info">
                          <CurrencyDisplay value={row.grossProfit} compact />
                        </td>
                        <td className="py-2.5 px-2 text-right text-success">
                          <CurrencyDisplay value={row.netProfit} compact />
                        </td>
                        <td className="py-2.5 px-2 text-right">{row.grossMarginPct}%</td>
                        <td className="py-2.5 px-2 text-right">{row.transactions}</td>
                        <td className="py-2.5 px-2 text-right">
                          {row.criticalStock > 0 ? (
                            <Badge variant="destructive" className="text-[10px]">
                              {row.criticalStock}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t">
                    <td className="py-2.5 px-2">Total</td>
                    <td className="py-2.5 px-2 text-right">
                      <CurrencyDisplay value={branchSummaryTotals.revenue} compact />
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <CurrencyDisplay value={branchSummaryTotals.grossProfit} compact />
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <CurrencyDisplay value={branchSummaryTotals.netProfit} compact />
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {branchSummaryTotals.revenue > 0
                        ? Math.round(
                            (branchSummaryTotals.grossProfit / branchSummaryTotals.revenue) * 100,
                          )
                        : 0}
                      %
                    </td>
                    <td className="py-2.5 px-2 text-right">{branchSummaryTotals.transactions}</td>
                    <td className="py-2.5 px-2 text-right">{branchSummaryTotals.criticalStock}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      <DashboardKpiDetailDialog
        kpiId={detailKpiId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={kpiDetailData}
        tenantSlug={tenantSlug}
      />
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  sub,
  delta,
  compareLabel,
  icon: Icon,
  gradient,
  alert,
  cta,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  delta?: number;
  compareLabel?: string;
  icon: typeof TrendingUp;
  gradient: "primary" | "success" | "warning" | "danger" | "info";
  alert?: boolean;
  cta?: { label: string; to: string; params?: Record<string, string> };
  onClick?: () => void;
}) {
  const grad = {
    primary: "bg-gradient-primary",
    success: "bg-gradient-success",
    warning: "bg-gradient-warning",
    danger: "bg-gradient-danger",
    info: "bg-gradient-info",
  }[gradient];

  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "p-5 relative overflow-hidden shadow-card",
        alert && "ring-1 ring-destructive/30",
        onClick &&
          "cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </div>
        <div className={cn("h-9 w-9 rounded-xl grid place-items-center text-white shrink-0", grad)}>
          <Icon style={{ width: 18, height: 18 }} />
        </div>
      </div>
      <div className="text-2xl font-bold mt-3 tracking-tight">{value}</div>
      <div className="flex items-center justify-between mt-1 gap-2">
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        {delta !== undefined && (
          <div
            className={cn(
              "text-xs font-medium flex items-center gap-0.5 shrink-0",
              delta >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
            {compareLabel && (
              <span className="text-muted-foreground font-normal ml-0.5">vs {compareLabel}</span>
            )}
          </div>
        )}
      </div>
      {cta && (
        <Link
          to={cta.to}
          params={cta.params}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {cta.label} <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </Card>
  );
}

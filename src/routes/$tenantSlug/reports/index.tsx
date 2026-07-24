import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  Award,
  BarChart3,
  ClipboardCheck,
  PackageSearch,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ExportReportButtons } from "@/components/reports/ExportReportButtons";
import { ReportScopeBadge } from "@/components/reports/ReportScopeBadge";
import { ReportsSubNav } from "@/components/reports/ReportsSubNav";
import { Card } from "@/components/ui/card";
import { useReports } from "@/hooks/useReports";
import { rupiah } from "@/lib/format";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";

export const Route = createFileRoute("/$tenantSlug/reports/")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "accountant"]);
  },
  head: () => ({
    meta: [
      { title: "Laporan — SEPS" },
      { name: "description", content: "Laporan penjualan, top produk, audit kasir, dan laba rugi." },
    ],
  }),
  component: ReportsHubPage,
});

const REPORT_LINKS = [
  {
    to: "/$tenantSlug/reports/sales" as const,
    title: "Laporan Penjualan",
    description: "Grafik dan tabel penjualan harian/mingguan/bulanan",
    icon: TrendingUp,
    color: "bg-gradient-primary",
  },
  {
    to: "/$tenantSlug/reports/profit-loss" as const,
    title: "Laba Rugi",
    description: "Penjualan, HPP, operasional, dan margin bersih",
    icon: BarChart3,
    color: "bg-gradient-info",
  },
  {
    to: "/$tenantSlug/reports/cashier-audit" as const,
    title: "Audit Kasir",
    description: "Transaksi per kasir, void, dan diskon berlebihan",
    icon: ClipboardCheck,
    color: "bg-gradient-warning",
  },
  {
    to: "/$tenantSlug/reports/stock-opname" as const,
    title: "Selisih Stock Opname",
    description: "Tabel selisih fisik vs sistem + estimasi kerugian",
    icon: PackageSearch,
    color: "bg-gradient-danger",
  },
];

function ReportsHubPage() {
  const { user, tenantSlug, scopeLabel, isConsolidated, salesReport, profitLoss, topProducts } =
    useReports("30");

  if (!user) return null;

  const subtitle = isConsolidated
    ? "Gabungan semua cabang — insight bisnis berbasis data"
    : `Laporan cabang ${scopeLabel} — insight bisnis berbasis data`;

  return (
    <AppShell
      title="Laporan"
      subtitle={subtitle}
      actions={<ExportReportButtons reportName="Ringkasan Laporan" />}
    >
      <ReportsSubNav />

      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <ReportScopeBadge scopeLabel={scopeLabel} isConsolidated={isConsolidated} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Penjualan 30 Hari</div>
          <div className="text-2xl font-bold mt-1">
            {rupiah(salesReport.summary.totalSales, { compact: true })}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Laba Bersih Bulan Ini</div>
          <div className="text-2xl font-bold mt-1 text-success">
            {rupiah(profitLoss.netProfit, { compact: true })}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Top Produk</div>
          <div className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Award className="h-5 w-5 text-warning" />
            {topProducts[0]?.name.slice(0, 18) ?? "—"}…
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {REPORT_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.to} to={link.to} params={{ tenantSlug }}>
              <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-start gap-4">
                  <div
                    className={`h-11 w-11 rounded-xl text-white grid place-items-center shrink-0 ${link.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{link.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

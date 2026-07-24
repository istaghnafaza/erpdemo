import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ExportReportButtons } from "@/components/reports/ExportReportButtons";
import { ProfitLossCard } from "@/components/finance/ProfitLossCard";
import { ReportScopeBadge } from "@/components/reports/ReportScopeBadge";
import { ReportsSubNav } from "@/components/reports/ReportsSubNav";
import { Card } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { useReports } from "@/hooks/useReports";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";

export const Route = createFileRoute("/$tenantSlug/reports/profit-loss")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireFeature(params.tenantSlug, "reports_profit_loss");
  },
  head: () => ({ meta: [{ title: "Laba Rugi — SEPS" }] }),
  component: ProfitLossReportPage,
});

function ProfitLossReportPage() {
  const { user, scopeLabel, isConsolidated, profitLoss, monthRange } = useReports("30");

  if (!user) return null;

  return (
    <AppShell
      title="Laporan Laba Rugi"
      subtitle={
        isConsolidated
          ? "P&L konsolidasi — dihitung otomatis dari transaksi kas"
          : `P&L cabang ${scopeLabel} — dihitung otomatis dari transaksi kas`
      }
      actions={<ExportReportButtons reportName="Laporan Laba Rugi" />}
    >
      <ReportsSubNav />

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <ReportScopeBadge scopeLabel={scopeLabel} isConsolidated={isConsolidated} />
        <span className="text-xs text-muted-foreground">
          Periode: {monthRange.from} s/d {monthRange.to}
        </span>
      </div>

      <ProfitLossCard data={profitLoss} />

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Rincian Laba Rugi</h3>
        <div className="space-y-3 text-sm">
          {[
            { label: "Penjualan", value: profitLoss.sales, sign: "+" },
            { label: "Total Margin Keuntungan", value: profitLoss.salesMargin, sign: "+", bold: true },
            { label: "Biaya Operasional", value: profitLoss.opex, sign: "−" },
            { label: "Laba Bersih", value: profitLoss.netProfit, sign: "=", bold: true, highlight: true },
          ].map((row) => (
            <div
              key={row.label}
              className={`flex items-center justify-between py-2 border-b last:border-0 ${
                row.highlight ? "text-success font-bold text-base" : row.bold ? "font-semibold" : ""
              }`}
            >
              <span>
                {row.sign} {row.label}
              </span>
              <span>
                <CurrencyDisplay value={row.value} className={row.bold ? "font-semibold" : undefined} />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t text-sm text-muted-foreground space-y-1">
          <div>
            Margin keuntungan:{" "}
            <span className="font-semibold text-foreground">{profitLoss.grossMarginPct}%</span>
          </div>
          <div>
            Margin laba bersih:{" "}
            <span className="font-semibold text-foreground">{profitLoss.marginPct}%</span>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ExportReportButtons } from "@/components/reports/ExportReportButtons";
import { ReportScopeBadge } from "@/components/reports/ReportScopeBadge";
import { ReportsSubNav } from "@/components/reports/ReportsSubNav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useBranchStore } from "@/stores/branch.store";
import { useReports } from "@/hooks/useReports";
import { rupiah, tanggal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";

export const Route = createFileRoute("/$tenantSlug/reports/stock-opname")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "accountant"]);
  },
  head: () => ({
    meta: [{ title: "Selisih Stock Opname — SEPS" }],
  }),
  component: StockOpnameReportPage,
});

function StockOpnameReportPage() {
  const branches = useBranchStore((s) => s.branches);
  const branchNameById = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const { user, scopeLabel, isConsolidated, opnameVariance, totalOpnameLoss } = useReports("30");

  if (!user) return null;

  return (
    <AppShell
      title="Selisih Stock Opname"
      subtitle={
        isConsolidated
          ? "Selisih fisik vs sistem — estimasi kerugian gabungan semua cabang"
          : `Selisih opname cabang ${scopeLabel}`
      }
      actions={<ExportReportButtons reportName="Selisih Stock Opname" />}
    >
      <ReportsSubNav />

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <ReportScopeBadge scopeLabel={scopeLabel} isConsolidated={isConsolidated} />
      </div>

      <Card className="p-4 mb-6">
        <div className="text-xs text-muted-foreground uppercase">Estimasi Kerugian Total</div>
        <div className="text-2xl font-bold mt-1 text-destructive">
          {rupiah(totalOpnameLoss)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {opnameVariance.length} baris selisih tercatat
        </div>
      </Card>

      <Card>
        <div className="p-5 border-b">
          <h3 className="font-semibold">Detail Selisih Opname</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Referensi</th>
                {isConsolidated && <th className="text-left px-4 py-3 font-medium">Cabang</th>}
                <th className="text-left px-4 py-3 font-medium">Produk</th>
                <th className="text-right px-4 py-3 font-medium">Sistem</th>
                <th className="text-right px-4 py-3 font-medium">Fisik</th>
                <th className="text-right px-4 py-3 font-medium">Selisih</th>
                <th className="text-right px-4 py-3 font-medium">Est. Kerugian</th>
                <th className="text-left px-4 py-3 font-medium">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {opnameVariance.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{row.reference}</td>
                  {isConsolidated && (
                    <td className="px-4 py-3 text-muted-foreground">
                      {branchNameById[row.branchId] ?? "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.productName}</div>
                    <div className="text-xs text-muted-foreground">{row.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{row.systemQty}</td>
                  <td className="px-4 py-3 text-right">{row.physicalQty}</td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-semibold",
                      row.variance < 0 && "text-destructive",
                      row.variance > 0 && "text-success",
                    )}
                  >
                    {row.variance > 0 ? `+${row.variance}` : row.variance}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.estimatedLoss > 0 ? (
                      <span className="text-destructive font-medium">
                        {rupiah(row.estimatedLoss)}
                      </span>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Surplus
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{tanggal(row.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}

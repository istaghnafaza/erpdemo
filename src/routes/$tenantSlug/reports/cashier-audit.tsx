import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ExportReportButtons } from "@/components/reports/ExportReportButtons";
import { ReportScopeBadge } from "@/components/reports/ReportScopeBadge";
import { ReportsSubNav } from "@/components/reports/ReportsSubNav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useReports } from "@/hooks/useReports";
import { rupiah, tanggal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";

export const Route = createFileRoute("/$tenantSlug/reports/cashier-audit")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireFeature(params.tenantSlug, "reports_cashier_audit");
  },
  head: () => ({ meta: [{ title: "Audit Kasir — SEPS" }] }),
  component: CashierAuditPage,
});

function CashierAuditPage() {
  const { user, scopeLabel, isConsolidated, cashierAudit } = useReports("30");

  if (!user) return null;

  return (
    <AppShell
      title="Audit Kasir"
      subtitle={
        isConsolidated
          ? "Rekap transaksi kasir gabungan semua cabang"
          : `Rekap transaksi kasir cabang ${scopeLabel}`
      }
      actions={<ExportReportButtons reportName="Audit Kasir" />}
    >
      <ReportsSubNav />

      <div className="mb-4">
        <ReportScopeBadge scopeLabel={scopeLabel} isConsolidated={isConsolidated} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {cashierAudit.cashiers.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-full bg-gradient-primary text-white grid place-items-center font-bold">
                {s.name.slice(0, 1)}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{s.name}</div>
                <Badge variant="secondary" className="text-[10px] mt-0.5">
                  {s.role}
                </Badge>
              </div>
              {s.excessiveDiscounts > 0 && (
                <Badge className="bg-warning/20 text-warning-foreground border-0 text-[10px]">
                  Diskon Mencurigakan
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/40 p-2">
                <div className="text-[10px] text-muted-foreground uppercase">Transaksi</div>
                <div className="text-lg font-bold">{s.transactions}</div>
              </div>
              <div className="rounded-lg bg-success/10 p-2">
                <div className="text-[10px] text-muted-foreground uppercase">Omzet</div>
                <div className="text-lg font-bold text-success">
                  {rupiah(s.revenue, { compact: true })}
                </div>
              </div>
              <div
                className={cn(
                  "rounded-lg p-2",
                  s.voids > 0 ? "bg-destructive/10" : "bg-muted/40",
                )}
              >
                <div className="text-[10px] text-muted-foreground uppercase">Void</div>
                <div className={cn("text-lg font-bold", s.voids > 0 && "text-destructive")}>
                  {s.voids}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="p-5 border-b">
          <h3 className="font-semibold">Transaksi Terbaru per Kasir</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Invoice</th>
                <th className="text-left px-4 py-3 font-medium">Waktu</th>
                <th className="text-left px-4 py-3 font-medium">Kasir</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cashierAudit.transactions.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{t.invoice}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tanggal(t.date, { withTime: true })}
                  </td>
                  <td className="px-4 py-3 font-medium">{t.cashier}</td>
                  <td className="px-4 py-3 text-right font-semibold">{rupiah(t.total)}</td>
                  <td className="px-4 py-3 text-center">
                    {t.status === "void" ? (
                      <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15 border-0">
                        Void
                      </Badge>
                    ) : (
                      <Badge className="bg-success/15 text-success hover:bg-success/15 border-0">
                        OK
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { History, Receipt, TrendingUp, WifiOff } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ReportScopeBadge } from "@/components/reports/ReportScopeBadge";
import { SalesTransactionDataTable } from "@/components/sales/SalesTransactionDataTable";
import { SalesTransactionDetailDialog } from "@/components/sales/SalesTransactionDetailDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSalesTransactionsPage } from "@/hooks/useSalesTransactionsPage";
import { rupiah } from "@/lib/format";
import { canViewSalesMargin } from "@/lib/rbac";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";

export const Route = createFileRoute("/$tenantSlug/sales/transactions")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireFeature(params.tenantSlug, "sales_history");
  },
  head: () => ({
    meta: [
      { title: "Histori Penjualan — SEPS" },
      {
        name: "description",
        content: "Daftar transaksi penjualan dengan filter dan pencarian fleksibel.",
      },
    ],
  }),
  component: SalesTransactionsPage,
});

function SalesTransactionsPage() {
  const {
    user,
    rows,
    scopeLabel,
    isConsolidated,
    summary,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    clearDateFilter,
    selectedTx,
    setSelectedTx,
  } = useSalesTransactionsPage();

  const currentTenant = useAuthStore((s) => s.currentTenant);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const branches = useBranchStore((s) => s.branches);
  const showMargin = canViewSalesMargin(user?.role);

  const selectedBranch = selectedTx
    ? branches.find((b) => b.id === selectedTx.branchId) ?? activeBranch
    : activeBranch;

  if (!user) return null;

  return (
    <AppShell
      title="Histori Penjualan"
      subtitle={
        user?.role === "cashier"
          ? "Riwayat transaksi penjualan Anda"
          : isConsolidated
            ? "Semua transaksi penjualan gabungan cabang"
            : `Transaksi penjualan cabang ${scopeLabel}`
      }
    >
      <div className="mb-4">
        <ReportScopeBadge scopeLabel={scopeLabel} isConsolidated={isConsolidated} />
      </div>

      <div className={`grid gap-4 sm:grid-cols-2 ${showMargin ? "lg:grid-cols-5" : "lg:grid-cols-4"} mb-6`}>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-600/10 grid place-items-center">
              <Receipt className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Transaksi</div>
              <div className="text-xl font-bold">{summary.totalRows}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-600/10 grid place-items-center">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Omzet (selesai)</div>
              <div className="text-xl font-bold">{rupiah(summary.totalRevenue, { compact: true })}</div>
            </div>
          </div>
        </Card>
        {showMargin && (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cyan-600/10 grid place-items-center">
                <TrendingUp className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Keuntungan (selesai)</div>
                <div className="text-xl font-bold">{rupiah(summary.totalMargin, { compact: true })}</div>
                <div className="text-[11px] text-muted-foreground">Margin {summary.marginPct}%</div>
              </div>
            </div>
          </Card>
        )}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-600/10 grid place-items-center">
              <History className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Selesai / Void</div>
              <div className="text-xl font-bold">
                {summary.completedCount}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / {summary.voidCount} void
                </span>
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-600/10 grid place-items-center">
              <WifiOff className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Transaksi Offline</div>
              <div className="text-xl font-bold">{summary.offlineCount}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="date-from" className="text-xs">
              Dari tanggal
            </Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-[170px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-to" className="text-xs">
              Sampai tanggal
            </Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-[170px]"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button variant="outline" size="sm" onClick={clearDateFilter}>
              Reset tanggal
            </Button>
          )}
        </div>
      </Card>

      <SalesTransactionDataTable
        data={rows}
        isConsolidated={isConsolidated}
        showMargin={showMargin}
        onRowClick={setSelectedTx}
      />

      <SalesTransactionDetailDialog
        transaction={selectedTx}
        storeName={currentTenant?.name ?? selectedBranch?.name ?? ""}
        branchAddress={selectedBranch?.address ?? null}
        branchPhone={selectedBranch?.phone ?? currentTenant?.phone ?? null}
        onClose={() => setSelectedTx(null)}
      />
    </AppShell>
  );
}

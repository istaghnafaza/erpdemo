import { createFileRoute } from "@tanstack/react-router";
import { Building2, Layers } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { FinanceSubNav } from "@/components/finance/FinanceSubNav";
import { CashAccountCards } from "@/components/finance/CashAccountCards";
import { ProfitLossCard } from "@/components/finance/ProfitLossCard";
import { CashFlowChart } from "@/components/finance/CashFlowChart";
import { FinanceBranchSummaryTable } from "@/components/finance/FinanceBranchSummaryTable";
import { ReceivablesSummaryCard } from "@/components/finance/ReceivablesSummaryCard";
import { CashVsAccrualCard } from "@/components/finance/CashVsAccrualCard";
import { useFinance } from "@/hooks/useFinance";
import { useCashVsAccrual } from "@/hooks/useCashflowIntelligence";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";

export const Route = createFileRoute("/$tenantSlug/finance/")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "accountant"]);
  },
  head: () => ({
    meta: [
      { title: "Keuangan — SEPS" },
      { name: "description", content: "Saldo kas/bank, laba rugi, dan arus kas real-time." },
    ],
  }),
  component: FinanceDashboardPage,
});

function FinanceDashboardPage() {
  const {
    user,
    loading,
    accounts,
    profitLoss,
    cashFlow,
    totalBalance,
    totalCash,
    totalBank,
    isConsolidated,
    scopeLabel,
    branchNameById,
    branchSummaries,
    receivablesSummary,
    tenantSlug,
  } = useFinance();
  const cashVsQuery = useCashVsAccrual();

  if (!user) return null;

  const subtitle = isConsolidated
    ? "Gabungan semua cabang — saldo, piutang, laba rugi, dan arus kas konsolidasi"
    : `Keuangan cabang ${scopeLabel} — saldo, piutang, laba rugi, dan arus kas`;

  return (
    <AppShell title="Keuangan" subtitle={subtitle}>
      <FinanceSubNav />

      <div className="mb-4">
        <Badge variant="secondary" className="gap-1.5">
          {isConsolidated ? (
            <Layers className="h-3 w-3" />
          ) : (
            <Building2 className="h-3 w-3" />
          )}
          {scopeLabel}
        </Badge>
      </div>

      {isConsolidated && (
        <FinanceBranchSummaryTable rows={branchSummaries} loading={loading} />
      )}

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            {isConsolidated ? "Total Saldo (Semua Cabang)" : "Total Saldo Cabang"}
          </div>
          <div className="text-2xl font-bold mt-1">
            <CurrencyDisplay value={totalBalance} compact />
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Kas</div>
          <div className="text-2xl font-bold mt-1 text-success">
            <CurrencyDisplay value={totalCash} compact />
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Bank</div>
          <div className="text-2xl font-bold mt-1 text-info">
            <CurrencyDisplay value={totalBank} compact />
          </div>
        </Card>
      </div>

      <ReceivablesSummaryCard
        data={receivablesSummary}
        tenantSlug={tenantSlug}
        monthLabel="Bulan Ini"
        loading={loading}
      />

      <CashVsAccrualCard data={cashVsQuery.data ?? null} loading={cashVsQuery.isPending} />

      <CashAccountCards
        accounts={accounts}
        loading={loading}
        branchNameById={branchNameById}
        showBranchLabel={isConsolidated}
        emptyMessage={
          isConsolidated
            ? "Belum ada akun kas/bank aktif."
            : "Belum ada akun kas/bank aktif untuk cabang ini."
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfitLossCard data={profitLoss} />
        <CashFlowChart data={cashFlow} />
      </div>
    </AppShell>
  );
}

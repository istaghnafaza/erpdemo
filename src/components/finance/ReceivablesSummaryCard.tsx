import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Receipt, TrendingUp, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { cn } from "@/lib/utils";
import type { ReceivablesSummary } from "@/lib/receivables-calculations";

interface ReceivablesSummaryCardProps {
  data: ReceivablesSummary;
  tenantSlug: string;
  monthLabel?: string;
  loading?: boolean;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tint,
  alert,
}: {
  label: string;
  value: number;
  icon: typeof Receipt;
  tint: "info" | "success" | "warning" | "danger";
  alert?: boolean;
}) {
  const grad = {
    info: "bg-gradient-info",
    success: "bg-gradient-success",
    warning: "bg-warning",
    danger: "bg-gradient-danger",
  }[tint];

  return (
    <Card className={cn("p-4 shadow-card", alert && "ring-1 ring-destructive/30")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </div>
          <div className="text-xl font-bold mt-1.5">
            <CurrencyDisplay value={value} compact />
          </div>
        </div>
        <div
          className={cn(
            "h-9 w-9 rounded-xl text-white grid place-items-center shrink-0",
            grad,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

export function ReceivablesSummaryCard({
  data,
  tenantSlug,
  monthLabel = "Bulan Ini",
  loading,
}: ReceivablesSummaryCardProps) {
  if (loading) {
    return (
      <div className="mb-6">
        <div className="h-6 w-40 bg-muted animate-pulse rounded mb-3" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 h-24 animate-pulse bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold">Ringkasan Piutang</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Saldo tagihan pelanggan — periode {monthLabel}
          </p>
        </div>
        <Link
          to="/$tenantSlug/receivables"
          params={{ tenantSlug }}
          className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 shrink-0"
        >
          Detail Piutang
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Saldo Piutang Aktif"
          value={data.totalOutstanding}
          icon={TrendingUp}
          tint="info"
        />
        <MetricCard
          label={`Piutang Baru (${monthLabel})`}
          value={data.newThisMonth}
          icon={Receipt}
          tint="warning"
        />
        <MetricCard
          label={`Ditagih (${monthLabel})`}
          value={data.collectedThisMonth}
          icon={Wallet}
          tint="success"
        />
        <MetricCard
          label="Piutang Terlambat"
          value={data.overdue}
          icon={Clock}
          tint="danger"
          alert={data.overdue > 0}
        />
      </div>

      {data.activeInvoiceCount > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {data.activeInvoiceCount} invoice belum lunas
        </p>
      )}
    </div>
  );
}

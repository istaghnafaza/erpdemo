import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AgingSummaryCard } from "@/components/ar-ap/AgingSummaryCard";
import { ArApScopeBadge } from "@/components/ar-ap/ArApScopeBadge";
import { ArApStatusBadge } from "@/components/ar-ap/ArApStatusBadge";
import { ArPaymentDialog } from "@/components/ar-ap/ArPaymentDialog";
import { CustomerDetailDialog } from "@/components/ar-ap/CustomerDetailDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useReceivablesPage } from "@/hooks/useReceivablesPage";
import { getArApStatus, remainingAmount } from "@/lib/ar-ap-utils";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { tanggal, daysBetween } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Clock, Receipt, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import type { Receivable } from "@/lib/mock-data";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";

export const Route = createFileRoute("/$tenantSlug/receivables")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "accountant"]);
  },
  head: () => ({
    meta: [
      { title: "Piutang — SEPS" },
      { name: "description", content: "Aging piutang, notifikasi jatuh tempo, dan pencatatan pembayaran." },
    ],
  }),
  component: ReceivablesPage,
});

function ReceivablesPage() {
  const navigate = useNavigate();
  const {
    user,
    isConsolidated,
    scopeLabel,
    branchNameById,
    receivables,
    payments,
    cashAccounts,
    totalOutstanding,
    overdueOutstanding,
    customerNameById,
    recordMockPayment,
  } = useReceivablesPage();

  const [payTarget, setPayTarget] = useState<Receivable | null>(null);
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role === "cashier") navigate({ to: "/login" });
  }, [user, navigate]);

  if (!user) return null;

  const subtitle = isConsolidated
    ? "Gabungan semua cabang — aging piutang dan pencatatan pembayaran"
    : `Piutang cabang ${scopeLabel} — aging dan pencatatan pembayaran`;

  return (
    <AppShell title="Piutang Pelanggan" subtitle={subtitle}>
      <ArApScopeBadge scopeLabel={scopeLabel} isConsolidated={isConsolidated} />

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <SummaryCard
          label="Total Piutang"
          value={totalOutstanding}
          icon={TrendingUp}
          tint="info"
        />
        <SummaryCard
          label="Piutang Terlambat"
          value={overdueOutstanding}
          icon={Clock}
          tint="danger"
          alert={overdueOutstanding > 0}
        />
      </div>

      <AgingSummaryCard
        items={receivables.map((r) => ({ amount: r.amount, paid: r.paid, dueDate: r.dueDate }))}
      />

      <Card className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Invoice</th>
                <th className="text-left px-4 py-3 font-medium">Pelanggan</th>
                {isConsolidated && <th className="text-left px-4 py-3 font-medium">Cabang</th>}
                <th className="text-left px-4 py-3 font-medium">Jatuh Tempo</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-right px-4 py-3 font-medium">Sisa</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {receivables.map((r) => {
                const remaining = remainingAmount(r.amount, r.paid);
                const days = daysBetween(new Date().toISOString(), r.dueDate);
                const status = getArApStatus(r.amount, r.paid, r.dueDate);
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{r.invoice}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-medium text-left hover:text-primary hover:underline"
                        onClick={() => setDetailCustomerId(r.customerId)}
                      >
                        {customerNameById[r.customerId] ?? "—"}
                      </button>
                    </td>
                    {isConsolidated && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {branchNameById[r.branchId] ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div>{tanggal(r.dueDate)}</div>
                      <div
                        className={cn(
                          "text-xs",
                          status === "overdue" ? "text-destructive font-medium" : "text-muted-foreground",
                        )}
                      >
                        {status === "overdue"
                          ? `Terlambat ${days} hari`
                          : days === 0
                            ? "Hari ini"
                            : `${-days} hari lagi`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CurrencyDisplay value={r.amount} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {remaining === 0 ? (
                        <span className="text-success">Lunas</span>
                      ) : (
                        <CurrencyDisplay value={remaining} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ArApStatusBadge status={status} />
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {remaining > 0 && (
                        <Button size="sm" variant="outline" onClick={() => setPayTarget(r)}>
                          Catat Bayar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ArPaymentDialog
        open={!!payTarget}
        receivable={payTarget}
        cashAccounts={cashAccounts}
        userId={user.id}
        onClose={() => setPayTarget(null)}
        onSubmit={(draft) => {
          const result = recordMockPayment(draft);
          if (!result.ok) toast.error(result.error ?? "Gagal mencatat pembayaran");
          return result;
        }}
        onSuccess={() => toast.success("Pembayaran tercatat — kas bertambah")}
      />

      <CustomerDetailDialog
        open={!!detailCustomerId}
        customerId={detailCustomerId}
        customerName={detailCustomerId ? (customerNameById[detailCustomerId] ?? "—") : ""}
        receivables={receivables}
        payments={payments}
        branchNameById={branchNameById}
        onClose={() => setDetailCustomerId(null)}
      />
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tint,
  alert,
}: {
  label: string;
  value: number;
  icon: typeof Receipt;
  tint: "info" | "danger";
  alert?: boolean;
}) {
  const grad = { info: "bg-gradient-info", danger: "bg-gradient-danger" }[tint];
  return (
    <Card className={cn("p-5 shadow-card", alert && "ring-1 ring-destructive/30")}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </div>
          <div className="text-xl font-bold mt-1.5">
            <CurrencyDisplay value={value} compact />
          </div>
        </div>
        <div className={cn("h-9 w-9 rounded-xl text-white grid place-items-center", grad)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

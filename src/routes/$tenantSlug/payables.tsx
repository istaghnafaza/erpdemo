import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AgingSummaryCard } from "@/components/ar-ap/AgingSummaryCard";
import { ApPaymentDialog } from "@/components/ar-ap/ApPaymentDialog";
import { ArApScopeBadge } from "@/components/ar-ap/ArApScopeBadge";
import { ArApStatusBadge } from "@/components/ar-ap/ArApStatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePayablesPage } from "@/hooks/usePayablesPage";
import { getArApStatus, remainingAmount } from "@/lib/ar-ap-utils";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { tanggal, daysBetween } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Clock, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import type { Payable } from "@/lib/mock-data";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";

export const Route = createFileRoute("/$tenantSlug/payables")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "accountant"]);
  },
  head: () => ({
    meta: [
      { title: "Hutang Supplier — SEPS" },
      { name: "description", content: "Aging hutang supplier, notifikasi jatuh tempo, dan pencatatan pembayaran." },
    ],
  }),
  component: PayablesPage,
});

function PayablesPage() {
  const navigate = useNavigate();
  const {
    user,
    isConsolidated,
    scopeLabel,
    branchNameById,
    payables,
    cashAccounts,
    totalOutstanding,
    overdueOutstanding,
    supplierNameById,
    recordMockPayment,
  } = usePayablesPage();

  const [payTarget, setPayTarget] = useState<Payable | null>(null);

  useEffect(() => {
    if (!user || user.role === "cashier") navigate({ to: "/login" });
  }, [user, navigate]);

  if (!user) return null;

  const subtitle = isConsolidated
    ? "Gabungan semua cabang — aging hutang dan pembayaran ke supplier"
    : `Hutang cabang ${scopeLabel} — aging dan pembayaran ke supplier`;

  return (
    <AppShell title="Hutang Supplier" subtitle={subtitle}>
      <ArApScopeBadge scopeLabel={scopeLabel} isConsolidated={isConsolidated} />

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card className="p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Total Hutang
              </div>
              <div className="text-xl font-bold mt-1.5">
                <CurrencyDisplay value={totalOutstanding} compact />
              </div>
            </div>
            <div className="h-9 w-9 rounded-xl text-white grid place-items-center bg-gradient-warning">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
        </Card>
        <Card className={cn("p-5 shadow-card", overdueOutstanding > 0 && "ring-1 ring-destructive/30")}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Hutang Terlambat
              </div>
              <div className="text-xl font-bold mt-1.5">
                <CurrencyDisplay value={overdueOutstanding} compact />
              </div>
            </div>
            <div className="h-9 w-9 rounded-xl text-white grid place-items-center bg-gradient-danger">
              <Clock className="h-4 w-4" />
            </div>
          </div>
        </Card>
      </div>

      <AgingSummaryCard
        items={payables.map((p) => ({ amount: p.amount, paid: p.paid, dueDate: p.dueDate }))}
      />

      <Card className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Invoice</th>
                <th className="text-left px-4 py-3 font-medium">Supplier</th>
                {isConsolidated && <th className="text-left px-4 py-3 font-medium">Cabang</th>}
                <th className="text-left px-4 py-3 font-medium">Jatuh Tempo</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-right px-4 py-3 font-medium">Sisa</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payables.map((p) => {
                const remaining = remainingAmount(p.amount, p.paid);
                const days = daysBetween(new Date().toISOString(), p.dueDate);
                const status = getArApStatus(p.amount, p.paid, p.dueDate);
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{p.invoice}</td>
                    <td className="px-4 py-3 font-medium">{supplierNameById[p.supplierId] ?? "—"}</td>
                    {isConsolidated && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {branchNameById[p.branchId] ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div>{tanggal(p.dueDate)}</div>
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
                      <CurrencyDisplay value={p.amount} />
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
                    <td className="px-4 py-3 text-right">
                      {remaining > 0 && (
                        <Button size="sm" variant="outline" onClick={() => setPayTarget(p)}>
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

      <ApPaymentDialog
        open={!!payTarget}
        payable={payTarget}
        cashAccounts={cashAccounts}
        userId={user.id}
        onClose={() => setPayTarget(null)}
        onSubmit={(draft) => {
          const result = recordMockPayment(draft);
          if (!result.ok) toast.error(result.error ?? "Gagal mencatat pembayaran");
          return result;
        }}
        onSuccess={() => toast.success("Pembayaran tercatat — kas berkurang")}
      />
    </AppShell>
  );
}

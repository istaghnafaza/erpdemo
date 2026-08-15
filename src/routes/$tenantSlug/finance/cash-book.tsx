import { createFileRoute } from "@tanstack/react-router";
import { Plus, Building2, Layers, ArrowLeftRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinanceSubNav } from "@/components/finance/FinanceSubNav";
import { CashBookList } from "@/components/finance/CashBookList";
import { ExpenseFormDialog } from "@/components/finance/ExpenseFormDialog";
import { TransferCashDialog } from "@/components/finance/TransferCashDialog";
import { useCashBook } from "@/hooks/useCashBook";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";
import { toast } from "sonner";
import type { DbCashTxType } from "@/types/database";

export const Route = createFileRoute("/$tenantSlug/finance/cash-book")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "accountant"]);
  },
  head: () => ({ meta: [{ title: "Buku Kas — SEPS" }] }),
  component: CashBookPage,
});

function CashBookPage() {
  const {
    user,
    loading,
    transactions,
    accounts,
    expenseCategories,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    accountFilter,
    setAccountFilter,
    typeFilter,
    setTypeFilter,
    formOpen,
    setFormOpen,
    transferOpen,
    setTransferOpen,
    actionLoading,
    recordExpense,
    transferCash,
    isConsolidated,
    scopeLabel,
    branchNameById,
    canRecordExpense,
  } = useCashBook();

  if (!user) return null;

  const subtitle = isConsolidated
    ? "Gabungan transaksi kas & bank semua cabang"
    : `Buku kas cabang ${scopeLabel}`;

  return (
    <AppShell
      title="Buku Kas"
      subtitle={subtitle}
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!canRecordExpense}
            onClick={() => setTransferOpen(true)}
          >
            <ArrowLeftRight className="h-4 w-4 mr-1.5" /> Pindah Kas
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!canRecordExpense}
            title={
              canRecordExpense
                ? undefined
                : "Pilih cabang spesifik untuk mencatat pengeluaran"
            }
            onClick={() => setFormOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Catat Pengeluaran
          </Button>
        </div>
      }
    >
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
        <Card className="p-4 mb-4 text-sm text-muted-foreground">
          Mode konsolidasi: menampilkan transaksi dari semua cabang. Untuk mencatat
          pengeluaran, pilih cabang spesifik di menu cabang.
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Dari</Label>
            <Input
              type="date"
              className="h-9 w-40"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sampai</Label>
            <Input
              type="date"
              className="h-9 w-40"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Akun</Label>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Akun</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {isConsolidated
                      ? `${branchNameById.get(a.branch_id) ?? ""} · ${a.name}`
                      : a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipe</Label>
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as DbCashTxType | "all")}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="income">Masuk</SelectItem>
                <SelectItem value="expense">Keluar</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <CashBookList
          transactions={transactions}
          loading={loading}
          branchNameById={branchNameById}
          showBranchColumn={isConsolidated}
        />
      </Card>

      <ExpenseFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        accounts={accounts}
        categories={expenseCategories}
        loading={actionLoading}
        onSubmit={async (data) => {
          const result = await recordExpense(data);
          if (result.success) toast.success("Pengeluaran dicatat");
          else toast.error(result.error ?? "Gagal");
          return result;
        }}
      />
      <TransferCashDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={accounts}
        loading={actionLoading}
        onSubmit={async (data) => {
          const result = await transferCash(data);
          if (result.success) toast.success("Kas dipindahkan");
          else toast.error(result.error ?? "Gagal");
          return result;
        }}
      />
    </AppShell>
  );
}

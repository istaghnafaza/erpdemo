import { Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { useBranchStore } from "@/stores/branch.store";
import type { FinanceBranchSummary } from "@/hooks/useFinance";

interface FinanceBranchSummaryTableProps {
  rows: FinanceBranchSummary[];
  loading?: boolean;
}

export function FinanceBranchSummaryTable({ rows, loading }: FinanceBranchSummaryTableProps) {
  const setActiveBranch = useBranchStore((s) => s.setActiveBranch);
  const branches = useBranchStore((s) => s.branches);

  if (loading) {
    return <Card className="p-6 mb-6 h-48 animate-pulse bg-muted/40" />;
  }

  if (rows.length === 0) return null;

  const totals = rows.reduce(
    (acc, row) => ({
      totalBalance: acc.totalBalance + row.totalBalance,
      sales: acc.sales + row.sales,
      netProfit: acc.netProfit + row.netProfit,
      receivablesOutstanding: acc.receivablesOutstanding + row.receivablesOutstanding,
    }),
    { totalBalance: 0, sales: 0, netProfit: 0, receivablesOutstanding: 0 },
  );

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center">
          <Layers className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Ringkasan per Cabang</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Klik baris untuk melihat detail keuangan cabang tersebut
          </p>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="text-left font-medium py-2 px-2">Cabang</th>
              <th className="text-right font-medium py-2 px-2">Total Saldo</th>
              <th className="text-right font-medium py-2 px-2">Piutang Aktif</th>
              <th className="text-right font-medium py-2 px-2">Penjualan (Bulan)</th>
              <th className="text-right font-medium py-2 px-2">Laba Bersih (Bulan)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const branch = branches.find((b) => b.id === row.branchId);
              return (
                <tr
                  key={row.branchId}
                  onClick={() => branch && setActiveBranch(branch)}
                  className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <td className="py-2.5 px-2 font-medium">{row.branchName}</td>
                  <td className="py-2.5 px-2 text-right">
                    <CurrencyDisplay value={row.totalBalance} compact />
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <CurrencyDisplay value={row.receivablesOutstanding} compact />
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <CurrencyDisplay value={row.sales} compact />
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <CurrencyDisplay value={row.netProfit} compact />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2.5 px-2">Total</td>
              <td className="py-2.5 px-2 text-right">
                <CurrencyDisplay value={totals.totalBalance} compact />
              </td>
              <td className="py-2.5 px-2 text-right">
                <CurrencyDisplay value={totals.receivablesOutstanding} compact />
              </td>
              <td className="py-2.5 px-2 text-right">
                <CurrencyDisplay value={totals.sales} compact />
              </td>
              <td className="py-2.5 px-2 text-right">
                <CurrencyDisplay value={totals.netProfit} compact />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

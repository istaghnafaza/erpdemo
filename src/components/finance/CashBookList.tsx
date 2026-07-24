import { ArrowDown, ArrowUp, ArrowLeftRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { DateDisplay } from "@/components/ui/date-display";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { cn } from "@/lib/utils";
import type { MockCashTxWithAccount } from "@/lib/mock-finance";

interface CashBookListProps {
  transactions: MockCashTxWithAccount[];
  loading?: boolean;
  branchNameById?: Map<string, string>;
  showBranchColumn?: boolean;
}

function txTypeLabel(type: MockCashTxWithAccount["type"]) {
  if (type === "income") return "Masuk";
  if (type === "expense") return "Keluar";
  return "Transfer";
}

function txTypeBadge(type: MockCashTxWithAccount["type"]) {
  if (type === "income") return "default" as const;
  if (type === "expense") return "destructive" as const;
  return "secondary" as const;
}

export function CashBookList({
  transactions,
  loading,
  branchNameById,
  showBranchColumn = false,
}: CashBookListProps) {
  if (loading) return <LoadingSkeleton variant="table-row" count={6} />;

  if (transactions.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Tidak ada transaksi untuk filter yang dipilih.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            {showBranchColumn && <TableHead>Cabang</TableHead>}
            <TableHead>Deskripsi</TableHead>
            <TableHead>Akun</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead className="text-right">Jumlah</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id} className="hover:bg-muted/30">
              <TableCell className="text-muted-foreground whitespace-nowrap">
                <DateDisplay value={tx.created_at} withTime />
              </TableCell>
              {showBranchColumn && (
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {branchNameById?.get(tx.branch_id) ?? "—"}
                </TableCell>
              )}
              <TableCell>
                <div className="font-medium">{tx.description ?? "—"}</div>
                {tx.reference && (
                  <div className="text-xs text-muted-foreground">{tx.reference}</div>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {tx.account?.name ?? "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {tx.category}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={txTypeBadge(tx.type)}
                  className={cn("text-xs", tx.type === "income" && "bg-success text-success-foreground")}
                >
                  {txTypeLabel(tx.type)}
                </Badge>
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-semibold",
                  tx.type === "income" && "text-success",
                  tx.type === "expense" && "text-destructive",
                )}
              >
                <span className="inline-flex items-center justify-end gap-1">
                  {tx.type === "income" ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : tx.type === "expense" ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowLeftRight className="h-3 w-3" />
                  )}
                  <CurrencyDisplay value={tx.amount} />
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

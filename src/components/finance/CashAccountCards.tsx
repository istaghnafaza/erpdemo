import { Landmark, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { cn } from "@/lib/utils";
import type { CashAccount } from "@/types/database";

interface CashAccountCardsProps {
  accounts: CashAccount[];
  loading?: boolean;
  branchNameById?: Map<string, string>;
  showBranchLabel?: boolean;
  emptyMessage?: string;
}

export function CashAccountCards({
  accounts,
  loading,
  branchNameById,
  showBranchLabel = false,
  emptyMessage = "Belum ada akun kas/bank aktif untuk cabang ini.",
}: CashAccountCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5 h-28 animate-pulse bg-muted/40" />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card className="p-6 mb-6 text-sm text-muted-foreground text-center">
        {emptyMessage}
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      {accounts.map((account) => (
        <Card key={account.id} className="p-5 shadow-card relative overflow-hidden">
          <div
            className={cn(
              "absolute inset-0 opacity-5",
              account.type === "bank" ? "bg-gradient-info" : "bg-gradient-success",
            )}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={cn(
                  "h-9 w-9 rounded-lg grid place-items-center text-white",
                  account.type === "bank" ? "bg-gradient-info" : "bg-gradient-success",
                )}
              >
                {account.type === "bank" ? (
                  <Landmark className="h-4 w-4" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
              </div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {account.type === "bank" ? "Bank" : "Kas"}
              </div>
            </div>
            <div className="text-sm font-medium text-muted-foreground">{account.name}</div>
            {showBranchLabel && branchNameById?.get(account.branch_id) && (
              <div className="text-xs text-muted-foreground/80 mt-0.5">
                {branchNameById.get(account.branch_id)}
              </div>
            )}
            <div className="text-xl font-bold mt-1">
              <CurrencyDisplay value={account.balance} compact />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

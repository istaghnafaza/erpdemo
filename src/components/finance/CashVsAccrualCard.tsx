import { useState } from "react";
import { Wallet, TrendingUp, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CashVsAccrualReport } from "@/lib/cashflow-types";

interface CashVsAccrualCardProps {
  data: CashVsAccrualReport | null;
  loading?: boolean;
}

export function CashVsAccrualCard({ data, loading }: CashVsAccrualCardProps) {
  const [open, setOpen] = useState(false);

  if (loading) return <LoadingSkeleton variant="card" />;

  const kas = data?.kasRiil ?? 0;
  const laba = data?.labaAkuntansi.netProfit ?? 0;
  const ar = data?.openArTotal ?? 0;

  return (
    <>
      <Card className="p-6 mb-6">
        <h3 className="font-semibold mb-1">Kas Riil vs Laba Akuntansi</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Untung di kertas belum tentu ada di kas. Penjelasan utama selisih: piutang belum cair.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
              <Wallet className="h-3.5 w-3.5" /> Kas Riil
            </div>
            <div className="text-xl font-bold mt-1">
              <CurrencyDisplay value={kas} compact />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
              <TrendingUp className="h-3.5 w-3.5" /> Laba Akuntansi
            </div>
            <div className="text-xl font-bold mt-1">
              <CurrencyDisplay value={laba} compact />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
              <Lock className="h-3.5 w-3.5" /> Piutang belum cair
            </div>
            <div className="text-xl font-bold mt-1">
              <CurrencyDisplay value={ar} compact />
            </div>
            <Button variant="link" className="h-auto p-0 text-xs mt-1" onClick={() => setOpen(true)}>
              Lihat daftar piutang
            </Button>
          </div>
        </div>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Piutang belum cair</SheetTitle>
            <SheetDescription>
              Invoice dengan sisa tagihan, diurutkan menurut jatuh tempo.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {(data?.openReceivables ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Tidak ada piutang terbuka.</p>
            )}
            {(data?.openReceivables ?? []).map((row) => (
              <div key={row.id} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{row.customerName}</div>
                <div className="text-xs text-muted-foreground font-mono">{row.invoiceNumber}</div>
                <div className="flex justify-between mt-2">
                  <span className="text-muted-foreground">Jatuh tempo {row.dueDate}</span>
                  <CurrencyDisplay value={row.remainingAmount} />
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

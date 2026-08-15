import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { cn } from "@/lib/utils";
import type { ProfitLossSummary } from "@/lib/finance-calculations";

interface ProfitLossCardProps {
  data: ProfitLossSummary;
  periodLabel?: string;
}

function PnlRow({
  label,
  value,
  bold,
  large,
  muted,
  accent,
}: {
  label: string;
  value: number;
  bold?: boolean;
  large?: boolean;
  muted?: boolean;
  accent?: "success" | "info";
}) {
  return (
    <div className={cn("flex justify-between items-baseline", large ? "text-xl" : "text-base")}>
      <span className={cn(muted && "text-muted-foreground", bold && "font-semibold")}>{label}</span>
      <span
        className={cn(
          bold && "font-bold",
          accent === "success" && "text-success",
          accent === "info" && "text-info",
          value < 0 && !accent && "text-muted-foreground",
        )}
      >
        {value < 0 ? "(" : ""}
        <CurrencyDisplay value={Math.abs(value)} />
        {value < 0 ? ")" : ""}
      </span>
    </div>
  );
}

export function ProfitLossCard({ data, periodLabel = "Bulan Ini" }: ProfitLossCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="h-5 w-5 text-success" />
        <h3 className="font-semibold">Laporan Laba Rugi — {periodLabel}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-6">
        Margin keuntungan dari penjualan stok (harga jual − harga beli). Baris SO baru masuk
        setelah barang keluar. Opex dari buku kas (bukan prive/setoran/HPP).
      </p>
      <div className="max-w-xl space-y-3">
        <PnlRow label="Pendapatan Penjualan" value={data.sales} bold />
        <PnlRow label="Total Margin Keuntungan" value={data.salesMargin} accent="info" bold />
        <PnlRow label="Biaya Operasional" value={-data.opex} muted />
        <div className="border-t pt-3">
          <PnlRow label="Laba Bersih" value={data.netProfit} accent="success" bold large />
        </div>
        {data.sales > 0 && (
          <div className="text-xs text-muted-foreground pt-2 space-y-0.5">
            <div>
              Margin keuntungan:{" "}
              <span className="font-semibold text-info">{data.grossMarginPct}%</span>
            </div>
            <div>
              Margin laba bersih:{" "}
              <span className="font-semibold text-success">{data.marginPct}%</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

import { Card } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import type { CashFlowDay } from "@/lib/finance-calculations";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface CashFlowChartProps {
  data: CashFlowDay[];
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const chartData = data.map((d) => ({
    date: d.label,
    Masuk: d.inflow,
    Keluar: d.outflow,
  }));

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-1">Arus Kas — 14 Hari Terakhir</h3>
      <p className="text-xs text-muted-foreground mb-4">Perbandingan uang masuk vs keluar</p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 0, right: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.012 260)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) =>
                new Intl.NumberFormat("id-ID", {
                  notation: "compact",
                  compactDisplay: "short",
                }).format(v)
              }
            />
            <Tooltip
              formatter={(v: number) =>
                new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  maximumFractionDigits: 0,
                }).format(v)
              }
              contentStyle={{ borderRadius: 10, fontSize: 12 }}
            />
            <Legend iconType="circle" />
            <Bar dataKey="Masuk" fill="oklch(0.65 0.17 155)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Keluar" fill="oklch(0.6 0.23 25)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { FinanceSubNav } from "@/components/finance/FinanceSubNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { useCashForecast } from "@/hooks/useCashflowIntelligence";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/$tenantSlug/finance/forecast")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "accountant"]);
  },
  head: () => ({ meta: [{ title: "Forecast Kas — SEPS" }] }),
  component: CashForecastPage,
});

function CashForecastPage() {
  const query = useCashForecast();
  const data = query.data;

  return (
    <AppShell
      title="Forecast Kas 30 Hari"
      subtitle="Proyeksi saldo: AR jatuh tempo + rata-rata kas masuk POS − AP jatuh tempo"
    >
      <FinanceSubNav />

      {query.isPending ? (
        <LoadingSkeleton variant="card" />
      ) : !data ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Forecast kas tersedia setelah data Neon (AR, AP, dan buku kas) terhubung.
        </Card>
      ) : (
        <>
          {data.goesNegative && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
              Saldo diproyeksikan negatif mulai {data.firstNegativeDate}. Tinjau tagihan dan
              penagihan piutang.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase">Saldo awal</div>
              <div className="text-xl font-bold mt-1">
                <CurrencyDisplay value={data.startingBalance} compact />
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase">Saldo hari ke-30</div>
              <div className="text-xl font-bold mt-1">
                <CurrencyDisplay value={data.endBalance} compact />
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase">Avg kas masuk POS / hari</div>
              <div className="text-xl font-bold mt-1">
                <CurrencyDisplay value={data.avgDailyPosIn} compact />
              </div>
            </Card>
          </div>

          <Card className="p-4 mb-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.days}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat("id-ID").format(value)
                  }
                />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" />
                <Line
                  type="monotone"
                  dataKey="projectedBalance"
                  name="Saldo"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">Tanggal</th>
                  <th className="p-3 text-right">AR jatuh tempo</th>
                  <th className="p-3 text-right">Avg POS</th>
                  <th className="p-3 text-right">AP jatuh tempo</th>
                  <th className="p-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => (
                  <tr key={d.date} className="border-b last:border-0">
                    <td className="p-3">{d.label}</td>
                    <td className="p-3 text-right">
                      <CurrencyDisplay value={d.arDue} compact />
                    </td>
                    <td className="p-3 text-right">
                      <CurrencyDisplay value={d.avgPosIn} compact />
                    </td>
                    <td className="p-3 text-right">
                      <CurrencyDisplay value={d.apDue} compact />
                    </td>
                    <td className="p-3 text-right">
                      {d.projectedBalance < 0 && (
                        <Badge variant="destructive" className="mr-2">
                          Negatif
                        </Badge>
                      )}
                      <CurrencyDisplay value={d.projectedBalance} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </AppShell>
  );
}

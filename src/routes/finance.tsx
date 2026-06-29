import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { CASH_ACCOUNTS, CASH_BOOK, FINANCE_SUMMARY } from "@/lib/mock-data";
import { rupiah, tanggal } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet, Landmark, TrendingUp, ArrowDown, ArrowUp, Plus, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { SALES_HISTORY } from "@/lib/mock-data";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Keuangan — Simetri ERP" },
      { name: "description", content: "Buku kas, saldo bank, dan laporan laba rugi real-time." },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!user || user.role === "kasir") navigate({ to: "/login" }); }, [user, navigate]);
  if (!user) return null;

  const cashFlow = SALES_HISTORY.slice(-14).map((d) => ({
    date: tanggal(d.date).slice(0, 6),
    Masuk: d.total,
    Keluar: Math.round(d.total * 0.65 + (Math.sin(new Date(d.date).getDate()) + 1) * 250_000),
  }));

  return (
    <AppShell
      title="Keuangan"
      subtitle="Pantau arus kas, saldo bank, dan kinerja keuangan toko"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => toast.success("Laporan diunduh")}>
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Button size="sm" className="bg-gradient-primary" onClick={() => toast.success("Form transaksi kas dibuka")}>
            <Plus className="h-4 w-4 mr-1.5" /> Catat Transaksi
          </Button>
        </>
      }
    >
      {/* Account cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {CASH_ACCOUNTS.map((a) => (
          <Card key={a.id} className="p-5 shadow-card relative overflow-hidden">
            <div className={cn(
              "absolute inset-0 opacity-5",
              a.type === "bank" ? "bg-gradient-info" : "bg-gradient-success",
            )} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  "h-9 w-9 rounded-lg grid place-items-center text-white",
                  a.type === "bank" ? "bg-gradient-info" : "bg-gradient-success",
                )}>
                  {a.type === "bank" ? <Landmark className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                </div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {a.type === "bank" ? "Bank" : "Kas"}
                </div>
              </div>
              <div className="text-sm font-medium text-muted-foreground">{a.name}</div>
              <div className="text-xl font-bold mt-1">{rupiah(a.balance, { compact: true })}</div>
            </div>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="cashbook" className="mt-4">
        <TabsList>
          <TabsTrigger value="cashbook">Buku Kas</TabsTrigger>
          <TabsTrigger value="pnl">Laba Rugi</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="cashbook" className="mt-4">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                    <th className="text-left px-4 py-3 font-medium">Deskripsi</th>
                    <th className="text-left px-4 py-3 font-medium">Akun</th>
                    <th className="text-left px-4 py-3 font-medium">Kategori</th>
                    <th className="text-right px-4 py-3 font-medium">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {CASH_BOOK.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground">{tanggal(e.date)}</td>
                      <td className="px-4 py-3 font-medium">{e.description}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.account}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-muted">{e.category}</span>
                      </td>
                      <td className={cn("px-4 py-3 text-right font-semibold flex items-center justify-end gap-1", e.amount >= 0 ? "text-success" : "text-destructive")}>
                        {e.amount >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {rupiah(Math.abs(e.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pnl" className="mt-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-success" />
              <h3 className="font-semibold">Laporan Laba Rugi — Bulan Ini</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-6">Update real-time setiap transaksi</p>

            <div className="max-w-xl space-y-3">
              <PnlRow label="Pendapatan Penjualan" value={FINANCE_SUMMARY.monthSales} bold />
              <PnlRow label="Harga Pokok Penjualan (HPP)" value={-FINANCE_SUMMARY.monthCogs} muted />
              <div className="border-t pt-3">
                <PnlRow label="Laba Kotor" value={FINANCE_SUMMARY.monthGrossProfit} accent="info" bold />
              </div>
              <PnlRow label="Biaya Operasional" value={-FINANCE_SUMMARY.monthOpex} muted />
              <div className="border-t pt-3">
                <PnlRow label="Laba Bersih" value={FINANCE_SUMMARY.monthNetProfit} accent="success" bold large />
              </div>
              <div className="text-xs text-muted-foreground pt-2">
                Margin laba bersih: <span className="font-semibold text-success">{Math.round((FINANCE_SUMMARY.monthNetProfit / FINANCE_SUMMARY.monthSales) * 100)}%</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="cashflow" className="mt-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-1">Arus Kas — 14 Hari Terakhir</h3>
            <p className="text-xs text-muted-foreground mb-4">Perbandingan uang masuk vs keluar</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlow} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.012 260)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => rupiah(v, { compact: true }).replace("Rp ", "")} />
                  <Tooltip formatter={(v: number) => rupiah(v)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="Masuk" fill="oklch(0.65 0.17 155)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Keluar" fill="oklch(0.6 0.23 25)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function PnlRow({ label, value, bold, large, muted, accent }: {
  label: string; value: number; bold?: boolean; large?: boolean; muted?: boolean;
  accent?: "success" | "info";
}) {
  return (
    <div className={cn(
      "flex justify-between items-baseline",
      large ? "text-xl" : "text-base",
    )}>
      <span className={cn(muted && "text-muted-foreground", bold && "font-semibold")}>{label}</span>
      <span className={cn(
        bold && "font-bold",
        accent === "success" && "text-success",
        accent === "info" && "text-info",
        value < 0 && !accent && "text-muted-foreground",
      )}>
        {value < 0 ? "(" : ""}{rupiah(Math.abs(value))}{value < 0 ? ")" : ""}
      </span>
    </div>
  );
}

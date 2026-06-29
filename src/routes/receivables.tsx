import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { RECEIVABLES, PAYABLES, CUSTOMERS, SUPPLIERS, type Receivable, type Payable } from "@/lib/mock-data";
import { rupiah, tanggal, daysBetween } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Clock, TrendingUp, TrendingDown, Receipt, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/receivables")({
  head: () => ({
    meta: [
      { title: "Hutang & Piutang — Simetri ERP" },
      { name: "description", content: "Aging piutang & hutang, notifikasi jatuh tempo, dan pencatatan pembayaran." },
    ],
  }),
  component: ReceivablesPage,
});

type AgingBucket = "current" | "0-30" | "31-60" | "60+";

const bucketOf = (dueDate: string, amount: number, paid: number): AgingBucket => {
  if (amount - paid <= 0) return "current";
  const days = daysBetween(new Date().toISOString(), dueDate);
  if (days <= 0) return "current";
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  return "60+";
};

function ReceivablesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!user || user.role === "kasir") navigate({ to: "/login" }); }, [user, navigate]);
  const [payTarget, setPayTarget] = useState<{ kind: "r" | "p"; item: Receivable | Payable } | null>(null);
  const [payAmount, setPayAmount] = useState("");

  if (!user) return null;

  const totalReceivable = RECEIVABLES.reduce((s, r) => s + (r.amount - r.paid), 0);
  const overdueReceivable = RECEIVABLES.filter((r) => daysBetween(new Date().toISOString(), r.dueDate) > 0 && r.amount - r.paid > 0)
    .reduce((s, r) => s + (r.amount - r.paid), 0);
  const totalPayable = PAYABLES.reduce((s, p) => s + (p.amount - p.paid), 0);
  const overduePayable = PAYABLES.filter((p) => daysBetween(new Date().toISOString(), p.dueDate) > 0 && p.amount - p.paid > 0)
    .reduce((s, p) => s + (p.amount - p.paid), 0);

  return (
    <AppShell title="Hutang & Piutang" subtitle="Aging report dan pencatatan pembayaran">
      {/* Top stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <SummaryCard label="Total Piutang" value={rupiah(totalReceivable, { compact: true })} icon={TrendingUp} tint="info" />
        <SummaryCard label="Piutang Terlambat" value={rupiah(overdueReceivable, { compact: true })} icon={Clock} tint="danger" alert />
        <SummaryCard label="Total Hutang" value={rupiah(totalPayable, { compact: true })} icon={TrendingDown} tint="warning" />
        <SummaryCard label="Hutang Terlambat" value={rupiah(overduePayable, { compact: true })} icon={Clock} tint="danger" alert={overduePayable > 0} />
      </div>

      <Tabs defaultValue="receivable">
        <TabsList>
          <TabsTrigger value="receivable">Piutang Pelanggan</TabsTrigger>
          <TabsTrigger value="payable">Hutang Supplier</TabsTrigger>
        </TabsList>

        <TabsContent value="receivable" className="mt-4 space-y-4">
          <AgingSummary items={RECEIVABLES.map((r) => ({ amount: r.amount - r.paid, dueDate: r.dueDate, paid: r.paid }))} />
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Invoice</th>
                    <th className="text-left px-4 py-3 font-medium">Pelanggan</th>
                    <th className="text-left px-4 py-3 font-medium">Jatuh Tempo</th>
                    <th className="text-right px-4 py-3 font-medium">Total</th>
                    <th className="text-right px-4 py-3 font-medium">Sisa</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {RECEIVABLES.map((r) => {
                    const c = CUSTOMERS.find((x) => x.id === r.customerId)!;
                    const remaining = r.amount - r.paid;
                    const days = daysBetween(new Date().toISOString(), r.dueDate);
                    const overdue = days > 0 && remaining > 0;
                    return (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{r.invoice}</td>
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3">
                          <div>{tanggal(r.dueDate)}</div>
                          <div className={cn("text-xs", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                            {overdue ? `Terlambat ${days} hari` : days === 0 ? "Hari ini" : `${-days} hari lagi`}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{rupiah(r.amount)}</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {remaining === 0 ? <span className="text-success">Lunas</span> : rupiah(remaining)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {remaining === 0 ? (
                            <Badge className="bg-success/15 text-success hover:bg-success/15 border-0">Lunas</Badge>
                          ) : overdue ? (
                            <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15 border-0">Terlambat</Badge>
                          ) : days <= 7 ? (
                            <Badge className="bg-warning/20 text-warning-foreground hover:bg-warning/20 border-0">Segera</Badge>
                          ) : (
                            <Badge variant="secondary">Aktif</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {remaining > 0 && (
                            <Button size="sm" variant="outline" onClick={() => { setPayTarget({ kind: "r", item: r }); setPayAmount(String(remaining)); }}>
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
        </TabsContent>

        <TabsContent value="payable" className="mt-4 space-y-4">
          <AgingSummary items={PAYABLES.map((p) => ({ amount: p.amount - p.paid, dueDate: p.dueDate, paid: p.paid }))} />
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Invoice</th>
                    <th className="text-left px-4 py-3 font-medium">Supplier</th>
                    <th className="text-left px-4 py-3 font-medium">Jatuh Tempo</th>
                    <th className="text-right px-4 py-3 font-medium">Total</th>
                    <th className="text-right px-4 py-3 font-medium">Sisa</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {PAYABLES.map((p) => {
                    const s = SUPPLIERS.find((x) => x.id === p.supplierId)!;
                    const remaining = p.amount - p.paid;
                    const days = daysBetween(new Date().toISOString(), p.dueDate);
                    const overdue = days > 0 && remaining > 0;
                    return (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{p.invoice}</td>
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3">
                          <div>{tanggal(p.dueDate)}</div>
                          <div className={cn("text-xs", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                            {overdue ? `Terlambat ${days} hari` : days === 0 ? "Hari ini" : `${-days} hari lagi`}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{rupiah(p.amount)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{remaining === 0 ? <span className="text-success">Lunas</span> : rupiah(remaining)}</td>
                        <td className="px-4 py-3 text-center">
                          {remaining === 0 ? (
                            <Badge className="bg-success/15 text-success hover:bg-success/15 border-0">Lunas</Badge>
                          ) : overdue ? (
                            <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15 border-0">Terlambat</Badge>
                          ) : (
                            <Badge variant="secondary">Aktif</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {remaining > 0 && (
                            <Button size="sm" variant="outline" onClick={() => { setPayTarget({ kind: "p", item: p }); setPayAmount(String(remaining)); }}>
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
        </TabsContent>
      </Tabs>

      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran</DialogTitle>
          </DialogHeader>
          {payTarget && (
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <div className="text-muted-foreground text-xs">Invoice</div>
                <div className="font-mono font-semibold">{payTarget.item.invoice}</div>
                <div className="text-muted-foreground text-xs mt-2">Sisa Tagihan</div>
                <div className="text-lg font-bold text-primary">{rupiah(payTarget.item.amount - payTarget.item.paid)}</div>
              </div>
              <div>
                <Label className="text-xs">Jumlah Bayar (Rp)</Label>
                <Input
                  value={payAmount ? Number(payAmount).toLocaleString("id-ID") : ""}
                  onChange={(e) => setPayAmount(e.target.value.replace(/\D/g, ""))}
                  className="text-lg h-11 mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>Batal</Button>
            <Button
              className="bg-gradient-primary"
              onClick={() => { toast.success("Pembayaran tercatat"); setPayTarget(null); }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Simpan Pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function AgingSummary({ items }: { items: { amount: number; dueDate: string; paid: number }[] }) {
  const buckets: Record<AgingBucket, number> = { current: 0, "0-30": 0, "31-60": 0, "60+": 0 };
  items.forEach((i) => { buckets[bucketOf(i.dueDate, i.amount + i.paid, i.paid)] += i.amount; });
  const total = Object.values(buckets).reduce((s, v) => s + v, 0) || 1;

  const cells = [
    { key: "current" as const, label: "Belum Jatuh Tempo", color: "bg-success" },
    { key: "0-30" as const, label: "Terlambat 0-30 hari", color: "bg-warning" },
    { key: "31-60" as const, label: "Terlambat 31-60 hari", color: "bg-orange-500" },
    { key: "60+" as const, label: "Terlambat >60 hari", color: "bg-destructive" },
  ];

  return (
    <Card className="p-5">
      <div className="text-sm font-semibold mb-3">Aging Summary</div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden flex mb-4">
        {cells.map((c) => (
          <div key={c.key} className={c.color} style={{ width: `${(buckets[c.key] / total) * 100}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cells.map((c) => (
          <div key={c.key}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-sm", c.color)} />
              {c.label}
            </div>
            <div className="text-base font-bold mt-1">{rupiah(buckets[c.key], { compact: true })}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SummaryCard({ label, value, icon: Icon, tint, alert }: {
  label: string; value: string;
  icon: typeof Receipt;
  tint: "info" | "warning" | "danger";
  alert?: boolean;
}) {
  const grad = { info: "bg-gradient-info", warning: "bg-gradient-warning", danger: "bg-gradient-danger" }[tint];
  return (
    <Card className={cn("p-5 shadow-card", alert && "ring-1 ring-destructive/30")}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
          <div className="text-xl font-bold mt-1.5">{value}</div>
        </div>
        <div className={cn("h-9 w-9 rounded-xl text-white grid place-items-center", grad)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

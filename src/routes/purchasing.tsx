import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { PURCHASE_ORDERS, SUPPLIERS, type PurchaseOrder } from "@/lib/mock-data";
import { rupiah, tanggal } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Truck, PackageCheck, FileText, Send, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/purchasing")({
  head: () => ({
    meta: [
      { title: "Pembelian — Simetri ERP" },
      { name: "description", content: "Purchase order ke supplier dan penerimaan barang otomatis update stok." },
    ],
  }),
  component: PurchasingPage,
});

const STATUS = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  sent: { label: "Dikirim", color: "bg-info/15 text-info", icon: Send },
  partial: { label: "Sebagian Diterima", color: "bg-warning/20 text-warning-foreground", icon: PackageCheck },
  received: { label: "Diterima", color: "bg-success/15 text-success", icon: CheckCheck },
};

function PurchasingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!user || user.role === "kasir") navigate({ to: "/login" }); }, [user, navigate]);
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [showNew, setShowNew] = useState(false);

  if (!user) return null;

  return (
    <AppShell
      title="Pembelian"
      subtitle="Kelola order ke supplier dan penerimaan barang"
      actions={
        <Button size="sm" className="bg-gradient-primary" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> PO Baru
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {(["draft", "sent", "partial", "received"] as const).map((s) => {
          const count = PURCHASE_ORDERS.filter((p) => p.status === s).length;
          const cfg = STATUS[s];
          const Icon = cfg.icon;
          return (
            <Card key={s} className="p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-medium">{cfg.label}</div>
                  <div className="text-2xl font-bold mt-1">{count}</div>
                </div>
                <div className={cn("h-9 w-9 rounded-lg grid place-items-center", cfg.color)}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">No. PO</th>
                <th className="text-left px-4 py-3 font-medium">Supplier</th>
                <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                <th className="text-center px-4 py-3 font-medium">Item</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {PURCHASE_ORDERS.map((po) => {
                const supplier = SUPPLIERS.find((s) => s.id === po.supplierId)!;
                const total = po.items.reduce((s, i) => s + i.qty * i.price, 0);
                const cfg = STATUS[po.status];
                return (
                  <tr key={po.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setDetail(po)}>
                    <td className="px-4 py-3 font-mono text-xs font-medium">{po.number}</td>
                    <td className="px-4 py-3 font-medium">{supplier.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{tanggal(po.date)}</td>
                    <td className="px-4 py-3 text-center">{po.items.length}</td>
                    <td className="px-4 py-3 text-right font-semibold">{rupiah(total)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={cn("border-0", cfg.color)}>{cfg.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {po.status === "sent" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); toast.success(`Stok diperbarui dari ${po.number}`); }}
                        >
                          <Truck className="h-3.5 w-3.5 mr-1.5" /> Terima Barang
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

      {/* PO detail */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.number}</DialogTitle>
                <div className="text-xs text-muted-foreground">
                  {SUPPLIERS.find((s) => s.id === detail.supplierId)?.name} · {tanggal(detail.date)}
                </div>
              </DialogHeader>
              <div className="rounded-lg border divide-y">
                {detail.items.map((it) => (
                  <div key={it.sku} className="flex items-center gap-3 p-3 text-sm">
                    <div className="flex-1">
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground">{it.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{it.qty} × {rupiah(it.price)}</div>
                      <div className="font-semibold">{rupiah(it.qty * it.price)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Total</span>
                <span className="text-primary">{rupiah(detail.items.reduce((s, i) => s + i.qty * i.price, 0))}</span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buat Purchase Order Baru</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">
            Form pembuatan PO. Pilih supplier, tambahkan produk dan qty, lalu kirim ke supplier.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Batal</Button>
            <Button className="bg-gradient-primary" onClick={() => { toast.success("PO baru tersimpan sebagai draft"); setShowNew(false); }}>Simpan Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

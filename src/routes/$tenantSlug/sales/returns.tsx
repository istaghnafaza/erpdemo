import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, ShieldCheck, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import {
  approveLateReturnRefund,
  chooseReturnSettlement,
  completeReturnQc,
  completeReturnRefund,
  listActiveReturns,
} from "@/lib/api/returns";
import { canApproveLateReturn } from "@/lib/rbac";
import { rupiah, tanggal } from "@/lib/format";
import type { SalesReturnRecord } from "@/types/sales-returns";
import { toast } from "sonner";

export const Route = createFileRoute("/$tenantSlug/sales/returns")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireFeature(params.tenantSlug, "sales_returns");
  },
  head: () => ({
    meta: [{ title: "Retur Barang — SEPS" }],
  }),
  component: SalesReturnsPage,
});

function SalesReturnsPage() {
  const user = useAuthStore((s) => s.currentUser?.profile);
  const tenantId = useAuthStore((s) => s.currentTenant?.id ?? "");
  const branchId = useBranchStore((s) => s.activeBranch?.id ?? "");
  const [rows, setRows] = useState<SalesReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [qcTarget, setQcTarget] = useState<SalesReturnRecord | null>(null);
  const [qcNotes, setQcNotes] = useState("");
  const [qcPassed, setQcPassed] = useState<Record<string, boolean>>({});
  const [qcRejectReason, setQcRejectReason] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!tenantId || !branchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await listActiveReturns(tenantId, branchId);
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setRows(res.data ?? []);
  }, [tenantId, branchId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openQc = (row: SalesReturnRecord) => {
    setQcTarget(row);
    setQcNotes("");
    const passed: Record<string, boolean> = {};
    const reasons: Record<string, string> = {};
    for (const item of row.items) {
      passed[item.id] = true;
      reasons[item.id] = "";
    }
    setQcPassed(passed);
    setQcRejectReason(reasons);
  };

  const submitQc = async () => {
    if (!qcTarget || !user) return;
    setActionLoading(true);
    const lines = qcTarget.items.map((item) => ({
      returnItemId: item.id,
      passed: qcPassed[item.id] ?? false,
      rejectReason: qcRejectReason[item.id] || undefined,
    }));
    const res = await completeReturnQc(tenantId, qcTarget.id, user.id, lines, qcNotes || undefined);
    setActionLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`QC selesai — ${res.data!.returnNumber}`);
    setQcTarget(null);
    void refresh();
  };

  const handleSettlement = async (
    row: SalesReturnRecord,
    settlement: "standalone_refund" | "offset_in_new_sale",
    requestLateCash?: boolean,
  ) => {
    setActionLoading(true);
    const res = await chooseReturnSettlement(tenantId, row.id, settlement, { requestLateCash });
    setActionLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (settlement === "offset_in_new_sale") {
      toast.success("Retur siap dipotong di POS — pilih di panel pembayaran");
    } else if (requestLateCash) {
      toast.success("Menunggu approval manager untuk refund tunai");
    } else {
      toast.info("Lanjutkan refund tunai/transfer dari daftar retur selesai QC");
    }
    void refresh();
  };

  const handleApproveLate = async (row: SalesReturnRecord) => {
    if (!user) return;
    setActionLoading(true);
    const res = await approveLateReturnRefund(tenantId, row.id, user.id);
    setActionLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Retur lewat batas disetujui — siap refund");
    void refresh();
  };

  const handleRefund = async (row: SalesReturnRecord, method: "cash" | "transfer") => {
    if (!user) return;
    setActionLoading(true);
    const res = await completeReturnRefund(tenantId, user.id, {
      returnId: row.id,
      refundMethod: method,
      sessionId: "",
    });
    setActionLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Refund ${row.returnNumber} selesai`);
    void refresh();
  };

  if (!user) {
    return (
      <AppShell title="Retur Barang" subtitle="QC dan penyelesaian retur penjualan">
        <p className="text-muted-foreground text-sm">Memuat sesi...</p>
      </AppShell>
    );
  }

  if (!branchId) {
    return (
      <AppShell title="Retur Barang" subtitle="QC dan penyelesaian retur penjualan">
        <Card className="p-8 text-center text-muted-foreground">
          Pilih cabang aktif terlebih dahulu (Branch Switcher di header).
        </Card>
      </AppShell>
    );
  }

  const canApprove = canApproveLateReturn(user.role);

  return (
    <AppShell title="Retur Barang" subtitle="QC dan penyelesaian retur penjualan">
      {loading ? (
        <p className="text-muted-foreground text-sm">Memuat...</p>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <RotateCcw className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Tidak ada retur aktif untuk cabang ini.</p>
          <p className="text-xs mt-2">
            Buat pengajuan retur dari Histori Penjualan → buka transaksi → Retur Barang.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-mono font-semibold">{row.returnNumber}</div>
                  <div className="text-sm text-muted-foreground">
                    Dari {row.originalTransactionNumber} · {tanggal(row.requestedAt, { withTime: true })}
                  </div>
                  <div className="text-sm">{row.customerName ?? "Tanpa pelanggan"}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.isLateReturn && (
                    <Badge variant="destructive">Lewat batas</Badge>
                  )}
                  <Badge variant="secondary">{row.status.replace(/_/g, " ")}</Badge>
                </div>
              </div>

              <div className="mt-3 text-sm">
                {row.items.map((item) => (
                  <div key={item.id} className="flex justify-between py-1 border-b border-dashed last:border-0">
                    <span>
                      {item.productName} × {item.qtyRequested}
                    </span>
                    <span>{rupiah(item.unitRefundPrice * item.qtyRequested)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {row.status === "pending_qc" && (
                  <Button size="sm" onClick={() => openQc(row)}>
                    <ShieldCheck className="h-4 w-4 mr-1" /> QC
                  </Button>
                )}
                {row.status === "qc_completed" && row.settlement === "standalone_refund" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => void handleRefund(row, "cash")} disabled={actionLoading}>
                      <Wallet className="h-4 w-4 mr-1" /> Refund Tunai
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void handleRefund(row, "transfer")} disabled={actionLoading}>
                      Refund Transfer
                    </Button>
                  </>
                )}
                {row.status === "qc_completed" && !row.settlement && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleSettlement(row, "offset_in_new_sale")}
                      disabled={actionLoading}
                    >
                      Potong di Transaksi Baru
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void handleSettlement(
                          row,
                          "standalone_refund",
                          row.isLateReturn ? true : undefined,
                        )
                      }
                      disabled={actionLoading}
                    >
                      Refund Tunai/Transfer
                    </Button>
                  </>
                )}
                {row.status === "pending_approval" && canApprove && (
                  <Button size="sm" onClick={() => void handleApproveLate(row)} disabled={actionLoading}>
                    Approve Refund Lewat Batas
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!qcTarget} onOpenChange={(open) => !open && setQcTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>QC Retur — {qcTarget?.returnNumber}</DialogTitle>
          </DialogHeader>
          {qcTarget?.items.map((item) => (
            <div key={item.id} className="border rounded-md p-3 space-y-2">
              <div className="font-medium text-sm">{item.productName}</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={qcPassed[item.id] ? "default" : "outline"}
                  onClick={() => setQcPassed((p) => ({ ...p, [item.id]: true }))}
                >
                  Lolos
                </Button>
                <Button
                  size="sm"
                  variant={!qcPassed[item.id] ? "destructive" : "outline"}
                  onClick={() => setQcPassed((p) => ({ ...p, [item.id]: false }))}
                >
                  Tolak
                </Button>
              </div>
              {!qcPassed[item.id] && (
                <div>
                  <Label className="text-xs">Alasan tolak</Label>
                  <Textarea
                    rows={2}
                    value={qcRejectReason[item.id] ?? ""}
                    onChange={(e) =>
                      setQcRejectReason((p) => ({ ...p, [item.id]: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>
          ))}
          <div>
            <Label className="text-xs">Catatan QC</Label>
            <Textarea value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQcTarget(null)}>
              Batal
            </Button>
            <Button onClick={() => void submitQc()} disabled={actionLoading}>
              Selesaikan QC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

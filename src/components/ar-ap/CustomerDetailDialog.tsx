import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArApStatusBadge } from "@/components/ar-ap/ArApStatusBadge";
import { getArApStatus, remainingAmount } from "@/lib/ar-ap-utils";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { tanggal } from "@/lib/format";
import type { ArPaymentRecord, Receivable } from "@/lib/mock-data";

interface CustomerDetailDialogProps {
  open: boolean;
  customerId: string | null;
  customerName: string;
  receivables: Receivable[];
  payments: ArPaymentRecord[];
  branchNameById: Record<string, string>;
  onClose: () => void;
}

export function CustomerDetailDialog({
  open,
  customerId,
  customerName,
  receivables,
  payments,
  branchNameById,
  onClose,
}: CustomerDetailDialogProps) {
  if (!customerId) return null;

  const customerReceivables = receivables.filter((r) => r.customerId === customerId);
  const receivableIds = new Set(customerReceivables.map((r) => r.id));
  const customerPayments = payments.filter((p) => receivableIds.has(p.receivableId));
  const totalOutstanding = customerReceivables.reduce(
    (s, r) => s + remainingAmount(r.amount, r.paid),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Piutang — {customerName}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-muted/50 p-4 mb-4">
          <div className="text-xs text-muted-foreground uppercase">Total Piutang Aktif</div>
          <div className="text-2xl font-bold mt-1">
            <CurrencyDisplay value={totalOutstanding} />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {customerReceivables.length} invoice · {customerPayments.length} pembayaran tercatat
          </div>
        </div>

        <div className="space-y-4">
          <section>
            <h3 className="text-sm font-semibold mb-2">Daftar Piutang</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Invoice</th>
                    <th className="text-left px-3 py-2 font-medium">Cabang</th>
                    <th className="text-left px-3 py-2 font-medium">Jatuh Tempo</th>
                    <th className="text-right px-3 py-2 font-medium">Sisa</th>
                    <th className="text-center px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customerReceivables.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-mono text-xs">{r.invoice}</td>
                      <td className="px-3 py-2">{branchNameById[r.branchId] ?? "—"}</td>
                      <td className="px-3 py-2">{tanggal(r.dueDate)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        <CurrencyDisplay value={remainingAmount(r.amount, r.paid)} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <ArApStatusBadge status={getArApStatus(r.amount, r.paid, r.dueDate)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Riwayat Pembayaran</h3>
            {customerPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pembayaran tercatat.</p>
            ) : (
              <div className="space-y-2">
                {customerPayments.map((p) => {
                  const inv = customerReceivables.find((r) => r.id === p.receivableId)?.invoice;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">
                          <CurrencyDisplay value={p.amount} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tanggal(p.paymentDate, { withTime: true })}
                          {inv ? ` · ${inv}` : ""}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {branchNameById[p.branchId] ?? "—"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

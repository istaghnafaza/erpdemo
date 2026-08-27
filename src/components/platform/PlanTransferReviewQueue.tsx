import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  approvePlanTransferReview,
  ingestBcaMutasiPaste,
  listPlanTransferReview,
  rejectPlanTransferReview,
  type PlanTransferReviewRow,
} from "@/lib/api/plan-billing";
import { formatPlanPrice } from "@/lib/plan-config";

interface PlanTransferReviewQueueProps {
  onChanged?: () => void;
}

export function PlanTransferReviewQueue({ onChanged }: PlanTransferReviewQueueProps) {
  const [rows, setRows] = useState<PlanTransferReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bcaPaste, setBcaPaste] = useState("");
  const [ingesting, setIngesting] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await listPlanTransferReview();
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setRows(result.data ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleApprove = async (orderId: string) => {
    setBusyId(orderId);
    const result = await approvePlanTransferReview(orderId);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Plan ${result.data?.plan} diaktifkan — notifikasi terkirim`);
    void load();
    onChanged?.();
  };

  const handleReject = async (orderId: string) => {
    setBusyId(orderId);
    const result = await rejectPlanTransferReview(orderId, "Ditolak admin");
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice ditolak");
    void load();
  };

  const handleIngest = async () => {
    if (!bcaPaste.trim()) return;
    setIngesting(true);
    const result = await ingestBcaMutasiPaste({ body: bcaPaste });
    setIngesting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const d = result.data!;
    toast.success(
      `Mutasi: ${d.matched.length} cocok, ${d.activated.length} auto-aktif, ${d.review.length} review`,
    );
    setBcaPaste("");
    void load();
    onChanged?.();
  };

  const matchLabel = (row: PlanTransferReviewRow) => {
    const md = row.matchDetails ?? {};
    const bca = md.bca as { perfect?: boolean; amountMatch?: boolean } | undefined;
    const ocr = md.ocr as { perfect?: boolean; amountMatch?: boolean } | undefined;
    const parts: string[] = [];
    if (bca?.perfect) parts.push("BCA ✓");
    else if (bca?.amountMatch) parts.push("BCA nominal");
    else if (bca) parts.push("BCA?");
    if (ocr?.perfect) parts.push("OCR ✓");
    else if (ocr?.amountMatch) parts.push("OCR nominal");
    else if (row.hasProof) parts.push("OCR?");
    return parts.length ? parts.join(" · ") : "—";
  };

  return (
    <Card className="p-4 mb-6 space-y-4">
      <div>
        <h3 className="font-semibold">Antrian transfer BCA</h3>
        <p className="text-sm text-muted-foreground">
          Auto-aktif hanya jika mutasi BCA + OCR bukti cocok sempurna. Sisanya setujui manual.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Tempel email/notifikasi mutasi BCA (testing atau manual)
        </label>
        <Textarea
          value={bcaPaste}
          onChange={(e) => setBcaPaste(e.target.value)}
          rows={3}
          placeholder="Tempel isi email BCA KR/edc/transfer masuk..."
          className="text-xs font-mono"
        />
        <Button size="sm" variant="outline" disabled={ingesting || !bcaPaste.trim()} onClick={() => void handleIngest()}>
          {ingesting ? "Memproses..." : "Proses mutasi BCA"}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat antrian...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada invoice transfer pending/review.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Toko</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Berita</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.orderId}>
                  <TableCell>
                    <div className="font-medium text-sm">{row.tenantName}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                      {row.orderId}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {row.plan} · {row.billingCycle}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatPlanPrice(row.payAmount)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.paymentReference}</TableCell>
                  <TableCell className="text-xs">{matchLabel(row)}</TableCell>
                  <TableCell className="text-xs capitalize">{row.status}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-emerald-700"
                        disabled={busyId === row.orderId}
                        title="Setujui & aktifkan"
                        onClick={() => void handleApprove(row.orderId)}
                      >
                        {busyId === row.orderId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-destructive"
                        disabled={busyId === row.orderId}
                        title="Tolak"
                        onClick={() => void handleReject(row.orderId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Webhook otomatis: POST /api/plan-billing/bca-inbound dengan header x-plan-bca-secret
        (forward email BCA via Zapier/Make). Order lama: tempel mutasi di atas.
      </p>
    </Card>
  );
}

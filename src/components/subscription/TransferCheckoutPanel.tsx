import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPlanPrice } from "@/lib/plan-config";
import {
  getPlanTransferStatus,
  submitPlanPaymentProof,
  type PlanTransferCheckoutSession,
} from "@/lib/api/plan-billing";
import { cn } from "@/lib/utils";

interface TransferCheckoutPanelProps {
  tenantId: string;
  session: PlanTransferCheckoutSession;
  onPaid: () => void;
  onClose: () => void;
}

function copyText(text: string, label: string) {
  void navigator.clipboard.writeText(text);
  toast.success(`${label} disalin`);
}

export function TransferCheckoutPanel({
  tenantId,
  session,
  onPaid,
  onClose,
}: TransferCheckoutPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [polling, setPolling] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pollStatus = useCallback(async () => {
    setPolling(true);
    try {
      const result = await getPlanTransferStatus({
        tenantId,
        orderId: session.orderId,
      });
      if (result.data?.paid) {
        toast.success("Pembayaran dikonfirmasi — paket aktif!");
        onPaid();
      }
    } finally {
      setPolling(false);
    }
  }, [tenantId, session.orderId, onPaid]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void pollStatus();
    }, 8000);
    return () => window.clearInterval(id);
  }, [pollStatus]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Unggah gambar (JPG/PNG)");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Maks. 4 MB");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Gagal membaca file"));
        reader.readAsDataURL(file);
      });

      const result = await submitPlanPaymentProof({
        tenantId,
        orderId: session.orderId,
        imageBase64: dataUrl,
        mimeType: file.type,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data?.action === "activated") {
        toast.success("Pembayaran cocok — paket aktif!");
        onPaid();
      } else if (result.data?.action === "review") {
        toast.info(
          "Bukti diterima. Tim SEPS akan verifikasi (BCA + bukti harus cocok untuk aktivasi otomatis).",
        );
      } else {
        toast.info("Bukti diunggah. Lengkapi transfer sesuai nominal & berita di bawah.");
      }
      void pollStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah");
    } finally {
      setUploading(false);
    }
  };

  const expires = new Date(session.expiresAt).toLocaleString("id-ID");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Bank</span>
          <span className="font-medium">{session.bankName}</span>
        </div>
        <div className="flex justify-between gap-2 items-center">
          <span className="text-muted-foreground">No. rekening</span>
          <button
            type="button"
            className="font-mono font-semibold inline-flex items-center gap-1 hover:text-primary"
            onClick={() => copyText(session.accountNumber, "Rekening")}
          >
            {session.accountNumber}
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Atas nama</span>
          <span>{session.accountName}</span>
        </div>
        <div className="flex justify-between gap-2 items-center border-t pt-2">
          <span className="text-muted-foreground">Transfer persis</span>
          <button
            type="button"
            className="font-bold text-primary inline-flex items-center gap-1"
            onClick={() => copyText(String(session.payAmount), "Nominal")}
          >
            {formatPlanPrice(session.payAmount).replace("Rp", "Rp ")}
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex justify-between gap-2 items-start">
          <span className="text-muted-foreground shrink-0">Berita transfer</span>
          <button
            type="button"
            className="font-mono text-xs text-right inline-flex items-center gap-1 hover:text-primary"
            onClick={() => copyText(session.paymentReference, "Berita")}
          >
            {session.paymentReference}
            <Copy className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>
        {session.qrisHint ? (
          <p className="text-xs text-muted-foreground border-t pt-2">{session.qrisHint}</p>
        ) : null}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Transfer <strong>tepat</strong> nominal di atas (termasuk 3 digit unik). Berita wajib{" "}
        {session.paymentReference}. Berlaku sampai {expires}. Aktivasi otomatis jika mutasi BCA +
        bukti transfer cocok; selain itu antrian review admin.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Membaca bukti (OCR)...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Unggah bukti transfer
          </>
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full"
        disabled={polling}
        onClick={() => void pollStatus()}
      >
        {polling ? "Memeriksa status..." : "Periksa status pembayaran"}
      </Button>

      <Button type="button" variant="secondary" className="w-full" onClick={onClose}>
        Tutup
      </Button>
    </div>
  );
}

export function TransferPaidBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900",
        className,
      )}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      Pembayaran terkonfirmasi. Cek email/WA untuk akses paket.
    </div>
  );
}

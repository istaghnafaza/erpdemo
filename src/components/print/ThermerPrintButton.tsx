import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import type { ReceiptData } from "@/lib/build-receipt-data";
import {
  androidThermerSendIntentHref,
  bprintHref,
  detectMobilePrintPlatform,
  entriesToThermerShareText,
  openCustomSchemeHref,
  receiptToThermerEntries,
  sampleThermerEntries,
  sanitizePublicOrigin,
  thermerInlineHref,
  thermerJsonUrl,
  thermerSampleJsonUrl,
} from "@/lib/thermer-print";

export function ThermerPrintButton({
  receipt,
  publicOrigin,
  sample,
}: {
  receipt?: ReceiptData | null;
  publicOrigin: string;
  sample?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const platform = useMemo(() => detectMobilePrintPlatform(), []);
  const entries = sample || !receipt ? sampleThermerEntries() : receiptToThermerEntries(receipt);
  const shareText = entriesToThermerShareText(entries);

  const origin = sanitizePublicOrigin(
    publicOrigin || (typeof window !== "undefined" ? window.location.origin : ""),
    typeof window !== "undefined" ? window.location.origin : "",
  );

  const startBprint = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/print/thermer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entries),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        throw new Error(data.error ?? "Gagal menyimpan job cetak");
      }
      const href = bprintHref(thermerJsonUrl(origin, data.id));
      toast.success("Membuka Thermer");
      openCustomSchemeHref(href);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal cetak Thermer");
    } finally {
      setBusy(false);
    }
  };

  const startInlineIos = () => {
    toast.success("Membuka Thermer (data langsung)");
    openCustomSchemeHref(thermerInlineHref(entries));
  };

  const startAndroidSend = (chooser: boolean) => {
    toast.success(chooser ? "Pilih Thermer di daftar berbagi" : "Membuka Thermer");
    window.location.href = androidThermerSendIntentHref(shareText, { chooser });
  };

  if (platform === "android") {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => startAndroidSend(false)}>
          <Smartphone className="h-4 w-4 mr-1.5" />
          {sample ? "Uji Thermer Android" : "Cetak Thermer Android"}
        </Button>
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => startAndroidSend(true)}>
          <Smartphone className="h-4 w-4 mr-1.5" />
          Jika ke Play Store: pilih Thermer (berbagi)
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        disabled={busy}
        onClick={() => void startBprint()}
      >
        <Smartphone className="h-4 w-4 mr-1.5" />
        {busy ? "Menyiapkan…" : sample ? "Uji iPhone (bprint)" : "Cetak iPhone (bprint)"}
      </Button>
      <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={startInlineIos}>
        <Smartphone className="h-4 w-4 mr-1.5" />
        {sample ? "Uji iPad (data langsung)" : "Cetak iPad (data langsung)"}
      </Button>
    </div>
  );
}

export function ThermerTestLinks({ publicOrigin }: { publicOrigin: string }) {
  const origin = sanitizePublicOrigin(
    publicOrigin || (typeof window !== "undefined" ? window.location.origin : ""),
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const sampleUrl = thermerSampleJsonUrl(origin);
  const lanHint =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? "http://192.168.0.107:8081"
      : origin.startsWith("http")
        ? origin
        : `http://${origin}`;

  return (
    <div className="text-[11px] text-muted-foreground leading-snug space-y-1">
      <p>
        Android: tombol sekarang <strong>membuka app Thermer</strong> (share teks), bukan Play Store. Install Thermer
        dulu. Jika masih ke toko, tekan <strong>pilih Thermer (berbagi)</strong> lalu ketuk Thermer di daftar.
      </p>
      <p>
        HP yang situs tidak terjangkau:{" "}
        <span className="font-mono text-foreground">{lanHint}</span> termasuk http:// — matikan Chrome HTTPS-only.
      </p>
      <p>
        JSON uji:{" "}
        <a className="text-primary underline break-all" href={sampleUrl} target="_blank" rel="noreferrer">
          {sampleUrl}
        </a>
      </p>
    </div>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setLegacyMode } from "@/lib/api/tenants";
import { useAuthStore } from "@/stores/auth.store";

/** Mode operasional: kasir tetap bisa jual meski stok/opname belum lengkap. */
export function SoftOpenModeBanner({ canEdit }: { canEdit: boolean }) {
  const tenant = useAuthStore((s) => s.currentTenant);
  const [busy, setBusy] = useState(false);

  if (!tenant) return null;

  const active = Boolean(tenant.legacy_mode_active);

  const onToggle = async (next: boolean) => {
    if (!canEdit || busy) return;
    setBusy(true);
    const result = await setLegacyMode(tenant.id, next);
    setBusy(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? "Gagal mengubah mode");
      return;
    }
    useAuthStore.setState({
      currentTenant: { ...tenant, legacy_mode_active: next },
    });
    toast.success(
      next
        ? "Mode toko tetap buka aktif — kasir bisa jual meski stok 0"
        : "Mode dinonaktifkan — jual stok 0 hanya lewat SO/indent",
    );
  };

  return (
    <div
      className={
        active
          ? "rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start justify-between gap-4"
          : "rounded-lg border bg-muted/40 px-4 py-3 flex items-start justify-between gap-4"
      }
    >
      <div className="min-w-0 space-y-0.5">
        <div className="text-sm font-medium text-foreground">Mode toko tetap buka</div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Aktifkan saat input barang / opname belum selesai — kasir tetap bisa menjual tanpa
          menutup toko. Matikan setelah stok sudah akurat.
        </p>
      </div>
      <Switch
        checked={active}
        disabled={!canEdit || busy}
        onCheckedChange={(v) => void onToggle(v)}
        aria-label="Mode toko tetap buka"
      />
    </div>
  );
}

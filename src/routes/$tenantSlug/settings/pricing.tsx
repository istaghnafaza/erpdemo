import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SettingsSubNav } from "@/components/settings/SettingsSubNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";
import { usePricingSettings } from "@/hooks/usePricingSettings";
import type { CustomerPriceTier, VolumePriceTier } from "@/types/pricing";

export const Route = createFileRoute("/$tenantSlug/settings/pricing")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireFeature(params.tenantSlug, "settings");
  },
  component: PricingSettingsPage,
});

function PricingSettingsPage() {
  const {
    bundle,
    loading,
    saving,
    canEditPricing,
    setBundle,
    save,
    resetDraft,
    isDirty,
  } = usePricingSettings();

  if (loading || !bundle) {
    return (
      <AppShell title="Harga & Diskon" subtitle="Memuat konfigurasi…">
        <SettingsSubNav />
        <p className="text-sm text-muted-foreground p-4">Memuat konfigurasi harga…</p>
      </AppShell>
    );
  }

  const updateSettings = (patch: Partial<typeof bundle.settings>) => {
    setBundle({ ...bundle, settings: { ...bundle.settings, ...patch } });
  };

  const updateVolume = (code: string, patch: Partial<VolumePriceTier>) => {
    setBundle({
      ...bundle,
      volume_tiers: bundle.volume_tiers.map((t) =>
        t.tier_code === code ? { ...t, ...patch } : t,
      ),
    });
  };

  const updateCustomerTier = (code: string, patch: Partial<CustomerPriceTier>) => {
    setBundle({
      ...bundle,
      customer_tiers: bundle.customer_tiers.map((t) =>
        t.tier_code === code ? { ...t, ...patch } : t,
      ),
    });
  };

  return (
    <AppShell
      title="Harga & Diskon"
      subtitle="Tier volume, tier pelanggan, floor margin — owner/manager"
    >
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <SettingsSubNav />

      <section className="rounded-lg border bg-muted/30 p-4 text-sm space-y-3">
        <h2 className="font-semibold">Alur perhitungan (Manager / Owner)</h2>
        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
          <li>
            <strong className="text-foreground">Harga dasar</strong> — harga jual cabang di Inventory.
          </li>
          <li>
            <strong className="text-foreground">Floor price</strong> = HPP × (1 + margin min%). Atur
            margin min default di bawah; per kategori (opsional) di DB.
          </li>
          <li>
            <strong className="text-foreground">Tier volume (T0–T3)</strong> — qty atau nilai baris
            memenuhi syarat → diskon volume %.
          </li>
          <li>
            <strong className="text-foreground">Tier pelanggan (P0–P4)</strong> — diskon % (Master
            Pelanggan). Kontraktor = diskon % + tier volume.
          </li>
          <li>
            <strong className="text-foreground">Stack</strong> = volume% + pelanggan%, max = cap stack
            & cap per baris.
          </li>
          <li>
            <strong className="text-foreground">Harga net</strong> = max(dasar × (1 − stack%), floor).
          </li>
        </ol>
      </section>

      {!canEditPricing && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Anda hanya dapat melihat. Hubungi owner/manager untuk mengubah aturan.
        </p>
      )}

      <section className="rounded-lg border p-4 space-y-4">
        <h2 className="font-semibold text-sm">Batas diskon global</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field
            label="Maks stack (qty + pelanggan) %"
            value={bundle.settings.max_stack_discount_percent}
            disabled={!canEditPricing}
            onChange={(v) => updateSettings({ max_stack_discount_percent: v })}
          />
          <Field
            label="Maks per baris %"
            value={bundle.settings.max_line_discount_percent}
            disabled={!canEditPricing}
            onChange={(v) => updateSettings({ max_line_discount_percent: v })}
          />
          <Field
            label="Margin min default %"
            value={bundle.settings.default_min_margin_percent}
            disabled={!canEditPricing}
            onChange={(v) => updateSettings({ default_min_margin_percent: v })}
          />
        </div>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold text-sm">Tier harga volume (min belanja / qty)</h2>
        <p className="text-xs text-muted-foreground">
          Diskon tier volume + tier pelanggan dijumlahkan, dibatasi cap di atas. Floor = HPP × (1 +
          margin min).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-2">Kode</th>
                <th className="py-2 pr-2">Nama</th>
                <th className="py-2 pr-2">Min qty</th>
                <th className="py-2 pr-2">Min nilai baris (Rp)</th>
                <th className="py-2">Diskon %</th>
              </tr>
            </thead>
            <tbody>
              {bundle.volume_tiers.map((t) => (
                <tr key={t.tier_code} className="border-b border-border/60">
                  <td className="py-2 font-mono text-xs">{t.tier_code}</td>
                  <td className="py-2 pr-2">
                    <Input
                      className="h-8"
                      value={t.name}
                      disabled={!canEditPricing}
                      onChange={(e) => updateVolume(t.tier_code, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      className="h-8 w-24"
                      value={t.min_qty}
                      disabled={!canEditPricing}
                      onChange={(e) =>
                        updateVolume(t.tier_code, { min_qty: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      className="h-8 w-32"
                      value={t.min_line_amount}
                      disabled={!canEditPricing}
                      onChange={(e) =>
                        updateVolume(t.tier_code, {
                          min_line_amount: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td className="py-2">
                    <Input
                      type="number"
                      className="h-8 w-20"
                      value={t.discount_percent}
                      disabled={!canEditPricing}
                      onChange={(e) =>
                        updateVolume(t.tier_code, {
                          discount_percent: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold text-sm">Tier pelanggan (P0–P4)</h2>
        <p className="text-xs text-muted-foreground">
          Kontraktor (P3): diskon % + benefit tier volume — tanpa harga kontrak per SKU. Syarat
          omzet/transaksi sebagai panduan; penetapan tier manual di master pelanggan.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-2">Kode</th>
                <th className="py-2 pr-2">Nama</th>
                <th className="py-2 pr-2">Diskon %</th>
                <th className="py-2 pr-2">Min transaksi</th>
                <th className="py-2 pr-2">Min omzet (Rp)</th>
                <th className="py-2">Hari rolling</th>
              </tr>
            </thead>
            <tbody>
              {bundle.customer_tiers.map((t) => (
                <tr key={t.tier_code} className="border-b border-border/60">
                  <td className="py-2 font-mono text-xs">{t.tier_code}</td>
                  <td className="py-2 pr-2">
                    <Input
                      className="h-8"
                      value={t.name}
                      disabled={!canEditPricing}
                      onChange={(e) => updateCustomerTier(t.tier_code, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      className="h-8 w-20"
                      value={t.discount_percent}
                      disabled={!canEditPricing}
                      onChange={(e) =>
                        updateCustomerTier(t.tier_code, {
                          discount_percent: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      className="h-8 w-24"
                      value={t.min_transactions ?? ""}
                      placeholder="—"
                      disabled={!canEditPricing}
                      onChange={(e) =>
                        updateCustomerTier(t.tier_code, {
                          min_transactions: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      className="h-8 w-32"
                      value={t.min_rolling_omzet ?? ""}
                      placeholder="—"
                      disabled={!canEditPricing}
                      onChange={(e) =>
                        updateCustomerTier(t.tier_code, {
                          min_rolling_omzet: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td className="py-2">
                    <Input
                      type="number"
                      className="h-8 w-24"
                      value={t.rolling_days ?? ""}
                      placeholder="—"
                      disabled={!canEditPricing}
                      onChange={(e) =>
                        updateCustomerTier(t.tier_code, {
                          rolling_days: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canEditPricing && (
        <div className="flex gap-2">
          <Button onClick={() => void save()} disabled={saving || !isDirty} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Menyimpan…" : "Simpan konfigurasi"}
          </Button>
          {isDirty && (
            <Button variant="outline" onClick={resetDraft}>
              Batalkan perubahan
            </Button>
          )}
        </div>
      )}
    </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        className="h-9"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

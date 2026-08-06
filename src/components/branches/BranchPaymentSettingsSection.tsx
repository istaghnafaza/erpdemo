import { useCallback, useEffect, useState } from "react";
import { CreditCard, Plus, QrCode, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBranchPaymentSettings, saveBranchPaymentSettings } from "@/lib/api/payment-settings";
import {
  newQrisEntry,
  newTransferAccount,
  type BranchPaymentSettings,
  type QrisSetting,
  type TransferAccountSetting,
} from "@/types/payment-settings";
import { toast } from "sonner";
import type { BranchWithManager } from "@/lib/api/branches";

interface BranchPaymentSettingsSectionProps {
  tenantId: string;
  branches: BranchWithManager[];
}

export function BranchPaymentSettingsSection({
  tenantId,
  branches,
}: BranchPaymentSettingsSectionProps) {
  const activeBranches = branches.filter((b) => b.is_active);
  const [branchId, setBranchId] = useState(activeBranches[0]?.id ?? "");
  const [settings, setSettings] = useState<BranchPaymentSettings>({
    transferAccounts: [],
    qrisEntries: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || !branchId) return;
    setLoading(true);
    const result = await getBranchPaymentSettings(tenantId, branchId);
    setSettings(result.data ?? { transferAccounts: [], qrisEntries: [] });
    setLoading(false);
  }, [tenantId, branchId]);

  useEffect(() => {
    if (!branchId && activeBranches[0]) {
      setBranchId(activeBranches[0].id);
      return;
    }
    void load();
  }, [branchId, activeBranches, load]);

  const save = async () => {
    if (!branchId) return;
    setSaving(true);
    const result = await saveBranchPaymentSettings(tenantId, branchId, settings);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSettings(result.data!);
    toast.success("Pengaturan pembayaran disimpan");
  };

  const updateTransfer = (id: string, patch: Partial<TransferAccountSetting>) => {
    setSettings((s) => ({
      ...s,
      transferAccounts: s.transferAccounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const updateQris = (id: string, patch: Partial<QrisSetting>) => {
    setSettings((s) => ({
      ...s,
      qrisEntries: s.qrisEntries.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  };

  const onQrisImage = (id: string, file: File | null) => {
    if (!file) return;
    if (file.size > 800_000) {
      toast.error("Gambar QR maks. 800 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateQris(id, { imageUrl: String(reader.result ?? "") });
    };
    reader.readAsDataURL(file);
  };

  if (activeBranches.length === 0) return null;

  return (
    <Card className="p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pengaturan Pembayaran POS
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Rekening transfer & QRIS ditampilkan ke kasir sebelum konfirmasi bayar.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Label className="text-xs">Cabang</Label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih cabang" />
            </SelectTrigger>
            <SelectContent>
              {activeBranches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Rekening Transfer</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    transferAccounts: [...s.transferAccounts, newTransferAccount()],
                  }))
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Tambah rekening
              </Button>
            </div>
            {settings.transferAccounts.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
                Belum ada rekening. Tambahkan agar kasir bisa menampilkan nomor rekening saat bayar
                transfer.
              </p>
            ) : (
              settings.transferAccounts.map((acc) => (
                <div key={acc.id} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={acc.isActive}
                        onCheckedChange={(v) => updateTransfer(acc.id, { isActive: v === true })}
                      />
                      <span className="text-xs text-muted-foreground">Aktif di POS</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() =>
                        setSettings((s) => ({
                          ...s,
                          transferAccounts: s.transferAccounts.filter((a) => a.id !== acc.id),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Label (contoh: BCA Utama)"
                      value={acc.label}
                      onChange={(e) => updateTransfer(acc.id, { label: e.target.value })}
                    />
                    <Input
                      placeholder="Nama bank"
                      value={acc.bankName}
                      onChange={(e) => updateTransfer(acc.id, { bankName: e.target.value })}
                    />
                    <Input
                      placeholder="No. rekening"
                      value={acc.accountNumber}
                      onChange={(e) => updateTransfer(acc.id, { accountNumber: e.target.value })}
                    />
                    <Input
                      placeholder="Atas nama"
                      value={acc.accountHolder}
                      onChange={(e) => updateTransfer(acc.id, { accountHolder: e.target.value })}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-1.5">
                <QrCode className="h-4 w-4" />
                QRIS
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    qrisEntries: [...s.qrisEntries, newQrisEntry()],
                  }))
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Tambah QR
              </Button>
            </div>
            {settings.qrisEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
                Upload gambar QRIS agar tampil di layar kasir saat pelanggan bayar QRIS.
              </p>
            ) : (
              settings.qrisEntries.map((q) => (
                <div key={q.id} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={q.isActive}
                        onCheckedChange={(v) => updateQris(q.id, { isActive: v === true })}
                      />
                      <span className="text-xs text-muted-foreground">Aktif di POS</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() =>
                        setSettings((s) => ({
                          ...s,
                          qrisEntries: s.qrisEntries.filter((x) => x.id !== q.id),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Label (contoh: QRIS Toko Pusat)"
                    value={q.label}
                    onChange={(e) => updateQris(q.id, { label: e.target.value })}
                  />
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => onQrisImage(q.id, e.target.files?.[0] ?? null)}
                  />
                  {q.imageUrl ? (
                    <img
                      src={q.imageUrl}
                      alt={q.label || "QRIS"}
                      className="max-h-40 rounded-md border bg-white object-contain"
                    />
                  ) : null}
                </div>
              ))
            )}
          </div>

          <Button onClick={() => void save()} disabled={saving || !branchId}>
            {saving ? "Menyimpan..." : "Simpan pengaturan pembayaran"}
          </Button>
        </>
      )}
    </Card>
  );
}

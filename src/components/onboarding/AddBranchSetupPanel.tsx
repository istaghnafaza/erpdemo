import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { assignUserToBranch, createBranch } from "@/lib/api/branches";
import { isNeonBackend } from "@/lib/api/backend";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useOnboardingStore } from "@/stores/onboarding.store";

export function AddBranchSetupPanel() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentTenant = useAuthStore((s) => s.currentTenant);
  const branchName = useOnboardingStore((s) => s.branchName);
  const branchAddress = useOnboardingStore((s) => s.branchAddress);
  const storePhone = useOnboardingStore((s) => s.storePhone);
  const updateStoreInfo = useOnboardingStore((s) => s.updateStoreInfo);
  const finishAddBranchSetup = useOnboardingStore((s) => s.finishAddBranchSetup);

  const [saving, setSaving] = useState(false);

  const tenantSlug = currentTenant?.slug ?? "";

  const handleSubmit = async () => {
    if (!currentUser?.tenantId) return;
    if (!branchName.trim()) {
      toast.error("Nama cabang wajib diisi");
      return;
    }
    if (!branchAddress.trim()) {
      toast.error("Alamat cabang wajib diisi");
      return;
    }

    setSaving(true);

    if (isNeonBackend()) {
      const created = await createBranch(currentUser.tenantId, {
        code: branchName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3).padEnd(3, "X"),
        name: branchName.trim(),
        address: branchAddress.trim(),
        phone: storePhone?.trim() || null,
        is_active: true,
      });
      if (created.error || !created.data) {
        setSaving(false);
        toast.error(created.error ?? "Gagal membuat cabang");
        return;
      }
      if (currentUser.profile?.id) {
        await assignUserToBranch(currentUser.tenantId, currentUser.profile.id, created.data.id);
      }
      await useBranchStore.getState().loadBranches(currentUser.tenantId);
    } else {
      useBranchStore.getState().applyOnboardingBranch({
        tenantId: currentUser.tenantId,
        name: branchName.trim(),
        address: branchAddress.trim(),
        phone: storePhone,
      });
    }

    finishAddBranchSetup();
    setSaving(false);
    toast.success("Cabang baru ditambahkan");
    if (tenantSlug) {
      navigate({ to: "/$tenantSlug/toko-saya", params: { tenantSlug } });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-mesh flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-primary grid place-items-center shadow-glow mb-4">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Setup — Tambah Cabang</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Cabang baru hanya ditambahkan melalui Setup, bukan dari menu Toko Saya.
          </p>
        </div>

        <Card className="p-6 shadow-card space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="add-branch-name">Nama Cabang</Label>
            <Input
              id="add-branch-name"
              value={branchName}
              onChange={(e) => updateStoreInfo({ branchName: e.target.value })}
              placeholder="Contoh: Cabang Bekasi"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-branch-address">Alamat</Label>
            <Textarea
              id="add-branch-address"
              value={branchAddress}
              onChange={(e) => updateStoreInfo({ branchAddress: e.target.value })}
              rows={3}
              placeholder="Alamat lengkap cabang"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-branch-phone">Telepon Cabang (opsional)</Label>
            <Input
              id="add-branch-phone"
              value={storePhone}
              onChange={(e) => updateStoreInfo({ storePhone: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={saving}
              onClick={() => {
                finishAddBranchSetup();
                if (tenantSlug) {
                  navigate({ to: "/$tenantSlug/toko-saya", params: { tenantSlug } });
                } else {
                  navigate({ to: "/login" });
                }
              }}
            >
              Batal
            </Button>
            <Button
              className="flex-1 bg-gradient-primary"
              disabled={saving}
              onClick={() => void handleSubmit()}
            >
              {saving ? "Menyimpan..." : "Tambah Cabang"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

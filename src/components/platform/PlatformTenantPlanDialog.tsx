import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  dateInputToIsoEndOfDay,
  defaultPlanAccessDates,
  isoToDateInput,
  PLAN_LIMITS,
} from "@/lib/plan-config";
import { updatePlatformTenantAccess } from "@/lib/api/platform";
import type { PlatformTenantRow } from "@/types/platform";
import type { TenantPlan } from "@/types/app";
import type { BillingCycle } from "@/lib/plan-config";
import { toast } from "sonner";

const PLANS: TenantPlan[] = ["trial", "basic", "pro", "enterprise"];

export function PlatformTenantPlanDialog({
  tenant,
  open,
  onOpenChange,
  onSaved,
}: {
  tenant: PlatformTenantRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [plan, setPlan] = useState<TenantPlan>("trial");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [trialDate, setTrialDate] = useState("");
  const [renewDate, setRenewDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant || !open) return;
    const nextPlan = (["trial", "basic", "pro", "enterprise"].includes(tenant.plan)
      ? tenant.plan
      : "trial") as TenantPlan;
    setPlan(nextPlan);
    setCycle("monthly");
    setTrialDate(isoToDateInput(tenant.trialEndsAt));
    setRenewDate(isoToDateInput(tenant.planRenewsAt));
    setIsActive(tenant.isActive);
  }, [tenant, open]);

  const applyDefaults = () => {
    const d = defaultPlanAccessDates(plan, cycle);
    setTrialDate(isoToDateInput(d.trialEndsAt));
    setRenewDate(isoToDateInput(d.planRenewsAt));
  };

  const handlePlanChange = (next: TenantPlan) => {
    setPlan(next);
    const d = defaultPlanAccessDates(next, cycle);
    setTrialDate(isoToDateInput(d.trialEndsAt));
    setRenewDate(isoToDateInput(d.planRenewsAt));
  };

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    const result = await updatePlatformTenantAccess({
      tenantId: tenant.id,
      plan,
      billingCycle: cycle,
      trialEndsAt: plan === "trial" ? dateInputToIsoEndOfDay(trialDate) : null,
      planRenewsAt: plan === "trial" ? null : dateInputToIsoEndOfDay(renewDate),
      isActive,
      applyDefaultDates: false,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Plan ${tenant.name} disimpan`);
    onOpenChange(false);
    onSaved();
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah plan — {tenant.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Paket</Label>
            <Select value={plan} onValueChange={(v) => handlePlanChange(v as TenantPlan)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PLAN_LIMITS[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Ganti paket mengisi tanggal otomatis (bisa diubah manual).
            </p>
          </div>

          {plan !== "trial" ? (
            <div className="space-y-1.5">
              <Label>Siklus (untuk hitung tanggal otomatis)</Label>
              <Select
                value={cycle}
                onValueChange={(v) => {
                  const next = v as BillingCycle;
                  setCycle(next);
                  const d = defaultPlanAccessDates(plan, next);
                  setRenewDate(isoToDateInput(d.planRenewsAt));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Bulanan (30 hari)</SelectItem>
                  <SelectItem value="yearly">Tahunan (365 hari)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {plan === "trial" ? (
            <div className="space-y-1.5">
              <Label htmlFor="trial-end">Trial berakhir</Label>
              <Input
                id="trial-end"
                type="date"
                value={trialDate}
                onChange={(e) => setTrialDate(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="plan-renew">Aktif sampai</Label>
              <Input
                id="plan-renew"
                type="date"
                value={renewDate}
                onChange={(e) => setRenewDate(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Toko aktif (akun)</div>
              <p className="text-xs text-muted-foreground">Matikan jika toko harus diblokir total</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <Button type="button" variant="outline" size="sm" onClick={applyDefaults}>
            Isi tanggal otomatis dari paket
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { AlertTriangle, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradePlanSheet } from "@/components/subscription/UpgradePlanSheet";
import { getTenantPlanUsage, type TenantPlanUsage } from "@/lib/api/plan";
import { TRIAL_DAYS } from "@/lib/plan-config";
import { useAuthStore } from "@/stores/auth.store";

const PLAN_BADGE: Record<string, string> = {
  trial: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  basic: "bg-blue-500/15 text-blue-800 dark:text-blue-200",
  pro: "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  enterprise: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
};

export function PlanBanner() {
  const tenant = useAuthStore((s) => s.currentTenant);
  const isOwner = useAuthStore((s) => s.currentUser?.isOwner ?? false);
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId);
  const [usage, setUsage] = useState<TenantPlanUsage | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    if (!tenantId || !isOwner) return;
    void getTenantPlanUsage(tenantId, {
      tenant,
      branchCount: 0,
      userCount: 0,
    }).then(setUsage);
  }, [tenantId, isOwner, tenant?.plan, tenant?.trial_ends_at]);

  if (!tenant || !isOwner || !usage) return null;

  const { trialExpired, trialDaysLeft, limits } = usage;
  const atBranchLimit = !usage.canAddBranch && !trialExpired;
  const atUserLimit = !usage.canAddUser && !trialExpired;
  const showTrialWarning =
    usage.plan === "trial" && !trialExpired && trialDaysLeft <= 3;
  const renewSoon =
    Boolean(tenant.plan_renews_at) &&
    usage.plan !== "trial" &&
    new Date(tenant.plan_renews_at!).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000 &&
    new Date(tenant.plan_renews_at!).getTime() >= Date.now();

  if (!trialExpired && !showTrialWarning && !atBranchLimit && !atUserLimit && !renewSoon) {
    return null;
  }

  return (
    <>
      <div
        className={
          trialExpired
            ? "mx-4 lg:mx-8 mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 flex flex-wrap items-center gap-3 justify-between"
            : "mx-4 lg:mx-8 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center gap-3 justify-between"
        }
      >
        <div className="flex items-start gap-3 min-w-0">
          {trialExpired ? (
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          ) : (
            <Crown className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_BADGE[usage.plan] ?? ""}`}
              >
                {limits.label}
              </span>
              {usage.plan === "trial" && !trialExpired && (
                <span className="text-sm font-medium">
                  Trial — {trialDaysLeft} dari {TRIAL_DAYS} hari tersisa
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {trialExpired
                ? "Masa trial 7 hari berakhir. Upgrade untuk menambah cabang/pegawai dan lanjut berlangganan."
                : showTrialWarning
                  ? `Trial berakhir dalam ${trialDaysLeft} hari — pilih paket Basic, Pro, atau Enterprise.`
                  : renewSoon
                    ? "Langganan mendekati jatuh tempo — perpanjang lewat Midtrans agar tetap aktif."
                    : atBranchLimit && atUserLimit
                      ? `Batas cabang (${limits.maxBranches}) dan user (${limits.maxUsers}) tercapai.`
                      : atBranchLimit
                        ? `Batas cabang paket ${limits.label} (${limits.maxBranches}) tercapai — upgrade untuk cabang baru.`
                        : `Batas user paket ${limits.label} (${limits.maxUsers}) tercapai — upgrade untuk pegawai baru.`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={trialExpired ? "destructive" : "default"}
          onClick={() => setUpgradeOpen(true)}
        >
          <Sparkles className="h-4 w-4 mr-1.5" />
          Upgrade
        </Button>
      </div>
      <UpgradePlanSheet open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}

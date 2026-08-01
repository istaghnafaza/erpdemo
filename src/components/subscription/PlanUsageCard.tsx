import { Link } from "@tanstack/react-router";
import { Building2, Crown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatPlanPrice,
  getPlanLimits,
  isTrialExpired,
  PLAN_PRICING,
  trialDaysRemaining,
} from "@/lib/plan-config";
import type { Tenant } from "@/types/database";

interface PlanUsageCardProps {
  tenant: Tenant | null;
  activeBranches: number;
  activeUsers: number;
}

export function PlanUsageCard({ tenant, activeBranches, activeUsers }: PlanUsageCardProps) {
  if (!tenant) return null;

  const limits = getPlanLimits(tenant.plan);
  const branchPct = Math.min(100, (activeBranches / limits.maxBranches) * 100);
  const userPct = Math.min(100, (activeUsers / limits.maxUsers) * 100);
  const trialExpired = tenant.plan === "trial" && isTrialExpired(tenant.trial_ends_at);
  const daysLeft = trialDaysRemaining(tenant.trial_ends_at);

  const paidPricing =
    tenant.plan !== "trial" ? PLAN_PRICING[tenant.plan] : null;

  return (
    <Card className="p-5 shadow-card border-primary/10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">Langganan — {limits.label}</h3>
            {tenant.plan === "trial" ? (
              <p className="text-sm text-muted-foreground">
                {trialExpired
                  ? "Trial berakhir — upgrade untuk melanjutkan"
                  : `Trial ${daysLeft} hari tersisa (maks. 7 hari)`}
              </p>
            ) : paidPricing ? (
              <p className="text-sm text-muted-foreground">
                Basic Rp 499–599 rb · Pro Rp 749–849 rb · Enterprise Rp 1,999–2,499 rb
              </p>
            ) : null}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/pricing">Upgrade / Detail Paket</Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="h-4 w-4" /> Cabang aktif
            </span>
            <span className="font-medium">
              {activeBranches} / {limits.maxBranches >= 999 ? "∞" : limits.maxBranches}
            </span>
          </div>
          <Progress value={branchPct} className="h-2" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4" /> Pegawai aktif
            </span>
            <span className="font-medium">
              {activeUsers} / {limits.maxUsers >= 999 ? "∞" : limits.maxUsers}
            </span>
          </div>
          <Progress value={userPct} className="h-2" />
        </div>
      </div>

      {tenant.plan === "pro" && activeBranches >= 2 && (
        <p className="text-xs text-muted-foreground mt-4 border-t pt-3">
          Butuh cabang ke-3? Upgrade ke{" "}
          <strong>Enterprise</strong> ({formatPlanPrice(PLAN_PRICING.enterprise.yearly)}/tahun atau{" "}
          {formatPlanPrice(PLAN_PRICING.enterprise.monthly)}/bulan).
        </p>
      )}
    </Card>
  );
}

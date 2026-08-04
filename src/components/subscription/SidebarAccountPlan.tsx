import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPlanLimits,
  isTrialExpired,
  trialDaysRemaining,
  TRIAL_DAYS,
} from "@/lib/plan-config";
import { initials, roleLabel } from "@/types/app";
import type { AuthUser } from "@/types/app";
import type { Tenant } from "@/types/database";
import { AccountProfileDialog } from "@/components/account/AccountProfileDialog";

const PLAN_BADGE: Record<string, string> = {
  trial: "bg-amber-500/20 text-amber-100",
  basic: "bg-blue-500/20 text-blue-100",
  pro: "bg-violet-500/20 text-violet-100",
  enterprise: "bg-emerald-500/20 text-emerald-100",
};

interface SidebarAccountPlanProps {
  tenant: Tenant | null;
  user: AuthUser | null;
}

export function SidebarAccountPlan({ tenant, user }: SidebarAccountPlanProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  if (!tenant || !user) return null;

  const limits = getPlanLimits(tenant.plan);
  const trialExpired = tenant.plan === "trial" && isTrialExpired(tenant.trial_ends_at);
  const trialDaysLeft = trialDaysRemaining(tenant.trial_ends_at);
  const showUpgrade = tenant.plan !== "enterprise";

  return (
    <>
      <div className="rounded-xl bg-white/5 p-3 space-y-2.5">
        <div className="flex items-start gap-2 min-w-0">
          <div className="h-8 w-8 rounded-full bg-white/10 shrink-0 grid place-items-center text-[10px] font-bold">
            {initials(user.profile.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" title={user.profile.name}>
                  {user.profile.name}
                </p>
                <p className="text-[10px] text-sidebar-foreground/60 truncate">
                  {roleLabel(user.profile.role)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-sidebar-foreground/70 hover:text-white hover:bg-white/10"
                onClick={() => setProfileOpen(true)}
                title="Pengaturan profil"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <Crown className="h-3 w-3 text-primary-glow" />
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PLAN_BADGE[tenant.plan] ?? PLAN_BADGE.basic}`}
              >
                {limits.label}
              </span>
            </div>
            {tenant.plan === "trial" && (
              <p className="text-[10px] text-sidebar-foreground/60 mt-1 leading-relaxed">
                {trialExpired
                  ? "Trial berakhir — upgrade untuk melanjutkan"
                  : `${trialDaysLeft} dari ${TRIAL_DAYS} hari trial tersisa`}
              </p>
            )}
          </div>
        </div>

        <Button
          asChild
          size="sm"
          className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Link to="/pricing">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {showUpgrade ? "Upgrade Paket" : "Detail Paket"}
          </Link>
        </Button>
      </div>

      <AccountProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

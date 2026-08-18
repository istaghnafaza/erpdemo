import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradePlanSheet } from "@/components/subscription/UpgradePlanSheet";
import {
  getTenantAccessStatus,
  subscriptionLockedMessage,
  tenantAccessLabel,
  type TenantAccessStatus,
} from "@/lib/plan-config";
import { useAuthStore } from "@/stores/auth.store";
import { useState } from "react";
import type { Tenant } from "@/types/database";

export function tenantAccessOf(tenant: Tenant | null | undefined): TenantAccessStatus | null {
  if (!tenant) return null;
  return getTenantAccessStatus(tenant);
}

export function SubscriptionLockPanel({
  tenant,
  isOwner,
}: {
  tenant: Tenant;
  isOwner: boolean;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const status = getTenantAccessStatus(tenant);

  return (
    <>
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 max-w-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{tenantAccessLabel(status)}</div>
            <p className="text-sm text-muted-foreground mt-1">{subscriptionLockedMessage(status)}</p>
            {isOwner && status !== "inactive" ? (
              <Button className="mt-4" variant="destructive" onClick={() => setUpgradeOpen(true)}>
                Upgrade / Perpanjang
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground mt-3">
                Hubungi pemilik toko untuk mengaktifkan kembali langganan.
              </p>
            )}
          </div>
        </div>
      </div>
      <UpgradePlanSheet open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}

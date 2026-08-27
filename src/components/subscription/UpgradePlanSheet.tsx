import { useEffect, useState } from "react";
import { Building2, Crown, CreditCard, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TransferCheckoutPanel } from "@/components/subscription/TransferCheckoutPanel";
import {
  createPlanCheckout,
  createPlanTransferCheckout,
  openPlanSnapCheckout,
  type PlanTransferCheckoutSession,
} from "@/lib/api/plan-billing";
import {
  formatPlanPrice,
  getPlanCheckoutAmount,
  PLAN_LIMITS,
  type BillingCycle,
  type PaidTenantPlan,
} from "@/lib/plan-config";
import { usePlanPricing } from "@/hooks/usePlanPricing";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

const UPGRADE_PLANS: PaidTenantPlan[] = ["basic", "pro", "enterprise"];

type PayMethod = "transfer" | "midtrans";

interface UpgradePlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPlan?: PaidTenantPlan;
  initialCycle?: BillingCycle;
}

export function UpgradePlanSheet({
  open,
  onOpenChange,
  initialPlan = "pro",
  initialCycle = "monthly",
}: UpgradePlanSheetProps) {
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId);
  const tenant = useAuthStore((s) => s.currentTenant);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const { pricing } = usePlanPricing();
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const [selected, setSelected] = useState<PaidTenantPlan>(initialPlan);
  const [payMethod, setPayMethod] = useState<PayMethod>("transfer");
  const [busy, setBusy] = useState(false);
  const [transferSession, setTransferSession] = useState<PlanTransferCheckoutSession | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setCycle(initialCycle);
    setSelected(initialPlan);
    setTransferSession(null);
    setPayMethod("transfer");
  }, [open, initialCycle, initialPlan]);

  const startMidtransCheckout = async (plan: PaidTenantPlan, billingCycle: BillingCycle) => {
    if (!tenantId) {
      toast.error("Login sebagai owner toko untuk upgrade paket");
      return;
    }
    setBusy(true);
    try {
      const result = await createPlanCheckout({
        tenantId,
        plan,
        billingCycle,
      });
      if (result.error || !result.data) {
        toast.error(result.error ?? "Gagal membuat pembayaran");
        return;
      }

      onOpenChange(false);
      await new Promise((resolve) => window.setTimeout(resolve, 400));

      const outcome = await openPlanSnapCheckout(result.data);
      if (outcome === "success" || outcome === "pending") {
        toast.success(
          outcome === "success"
            ? "Pembayaran diterima. Paket akan aktif setelah konfirmasi Midtrans."
            : "Menunggu pembayaran. Paket aktif otomatis setelah lunas.",
        );
        setTimeout(() => {
          void refreshUser({ force: true });
        }, 2500);
      } else if (outcome === "error") {
        toast.error("Pembayaran gagal. Coba lagi atau hubungi tim SEPS.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout gagal");
    } finally {
      setBusy(false);
    }
  };

  const startTransferCheckout = async (plan: PaidTenantPlan, billingCycle: BillingCycle) => {
    if (!tenantId) {
      toast.error("Login sebagai owner toko untuk upgrade paket");
      return;
    }
    setBusy(true);
    try {
      const result = await createPlanTransferCheckout({
        tenantId,
        plan,
        billingCycle,
      });
      if (result.error || !result.data) {
        toast.error(result.error ?? "Gagal membuat invoice transfer");
        return;
      }
      setTransferSession(result.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout gagal");
    } finally {
      setBusy(false);
    }
  };

  const handlePay = () => {
    if (payMethod === "midtrans") {
      void startMidtransCheckout(selected, cycle);
    } else {
      void startTransferCheckout(selected, cycle);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Upgrade paket
          </SheetTitle>
          <SheetDescription>
            {tenant?.name
              ? `Pilih paket untuk ${tenant.name}.`
              : "Pilih paket dan metode pembayaran."}
          </SheetDescription>
        </SheetHeader>

        {transferSession ? (
          <div className="mt-6">
            <TransferCheckoutPanel
              tenantId={tenantId!}
              session={transferSession}
              onPaid={() => {
                setTransferSession(null);
                onOpenChange(false);
                void refreshUser({ force: true });
              }}
              onClose={() => setTransferSession(null)}
            />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="inline-flex p-1 rounded-full bg-muted border w-full">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPayMethod("transfer")}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors inline-flex items-center justify-center gap-1",
                  payMethod === "transfer"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground",
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                Transfer BCA
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPayMethod("midtrans")}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors inline-flex items-center justify-center gap-1",
                  payMethod === "midtrans"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground",
                )}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Midtrans
              </button>
            </div>

            <div className="inline-flex p-1 rounded-full bg-muted border">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCycle("monthly")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  cycle === "monthly"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground",
                )}
              >
                Bulanan
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCycle("yearly")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  cycle === "yearly"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground",
                )}
              >
                Tahunan
              </button>
            </div>

            <div className="space-y-2">
              {UPGRADE_PLANS.map((plan) => {
                const sticker =
                  cycle === "yearly" ? pricing[plan].yearly : pricing[plan].monthly;
                const charge = getPlanCheckoutAmount(plan, cycle, pricing);
                const active = selected === plan;
                return (
                  <button
                    key={plan}
                    type="button"
                    disabled={busy}
                    onClick={() => setSelected(plan)}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-colors",
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Crown
                          className={cn(
                            "h-4 w-4",
                            active ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span className="font-semibold">{PLAN_LIMITS[plan].label}</span>
                      </div>
                      <span className="text-sm font-medium text-right">
                        {formatPlanPrice(sticker)}
                        <span className="text-muted-foreground font-normal">/bln</span>
                        {cycle === "yearly" ? (
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            Tagih {formatPlanPrice(charge)} /th
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <Button
              className="w-full"
              disabled={busy || !tenantId}
              onClick={handlePay}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyiapkan...
                </>
              ) : payMethod === "transfer" ? (
                <>
                  <Building2 className="h-4 w-4 mr-2" />
                  Bayar transfer — {PLAN_LIMITS[selected].label}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Bayar Midtrans — {PLAN_LIMITS[selected].label}
                </>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {payMethod === "transfer"
                ? "Transfer ke rekening BCA + unggah bukti. Aktivasi otomatis jika mutasi bank & OCR cocok; email/WA dikirim setelah lunas."
                : "Midtrans Snap (QRIS/VA/GoPay). Aktivasi dari webhook notifikasi."}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

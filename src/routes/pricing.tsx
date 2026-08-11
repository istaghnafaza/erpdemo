import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  Crown,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpgradePlanSheet } from "@/components/subscription/UpgradePlanSheet";
import { APP_TAGLINE } from "@/lib/app-branding";
import {
  formatPlanPrice,
  PLAN_LIMITS,
  TRIAL_DAYS,
  type PaidTenantPlan,
} from "@/lib/plan-config";
import { usePlanPricing } from "@/hooks/usePlanPricing";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

export const Route = createFileRoute("/pricing")({
  validateSearch: (search: Record<string, unknown>): { plan?: PaidTenantPlan } => {
    const plan = search.plan;
    if (plan === "basic" || plan === "pro" || plan === "enterprise") {
      return { plan };
    }
    return {};
  },
  head: () => ({
    meta: [
      { title: "Harga & Paket — SEPS" },
      {
        name: "description",
        content:
          "Paket langganan SEPS untuk toko bangunan: Trial 7 hari, Basic, Pro, Enterprise.",
      },
    ],
  }),
  component: PricingPage,
});

type BillingCycle = "monthly" | "yearly";

const FEATURES = [
  "POS kasir multi-metode (tunai, QRIS, transfer, tempo)",
  "Stok real-time per cabang + transfer antar gudang",
  "Piutang, hutang, dan laporan laba rugi",
  "Multi-user dengan audit per kasir",
  "Dashboard owner & notifikasi stok kritis",
];

function PricingPage() {
  const { plan: planFromAd } = Route.useSearch();
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PaidTenantPlan>(planFromAd ?? "pro");
  const isOwner = useAuthStore((s) => s.currentUser?.isOwner ?? false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { pricing } = usePlanPricing();

  useEffect(() => {
    if (!planFromAd) return;
    setCheckoutPlan(planFromAd);
    if (isOwner) setUpgradeOpen(true);
  }, [planFromAd, isOwner]);

  const openCheckout = (plan: PaidTenantPlan) => {
    setCheckoutPlan(plan);
    setUpgradeOpen(true);
  };

  const plans = [
    {
      id: "trial" as const,
      name: "Trial",
      highlight: false,
      price: "Gratis",
      period: `${TRIAL_DAYS} hari`,
      desc: "Coba full fitur Pro — tanpa kartu kredit",
      limits: PLAN_LIMITS.trial,
      cta: "Daftar Trial",
      ctaTo: "/register" as const,
      features: [
        `${PLAN_LIMITS.trial.maxBranches} cabang`,
        `${PLAN_LIMITS.trial.maxUsers} user`,
        "Semua modul ERP aktif",
        `Maks. ${TRIAL_DAYS} hari`,
      ],
    },
    {
      id: "basic" as const,
      name: "Basic",
      highlight: false,
      price: formatPlanPrice(
        cycle === "yearly" ? pricing.basic.yearly : pricing.basic.monthly,
      ),
      period: cycle === "yearly" ? "/ tahun" : "/ bulan",
      desc: "Toko tunggal — operasional harian rapi",
      limits: PLAN_LIMITS.basic,
      cta: isOwner ? "Bayar Basic" : "Mulai Basic",
      ctaTo: "/register" as const,
      features: [
        `${PLAN_LIMITS.basic.maxBranches} cabang`,
        `${PLAN_LIMITS.basic.maxUsers} user`,
        "POS + stok + laporan",
        "Support email",
      ],
    },
    {
      id: "pro" as const,
      name: "Pro",
      highlight: true,
      price: formatPlanPrice(
        cycle === "yearly" ? pricing.pro.yearly : pricing.pro.monthly,
      ),
      period: cycle === "yearly" ? "/ tahun" : "/ bulan",
      desc: "Multi-cabang kecil — paling populer",
      limits: PLAN_LIMITS.pro,
      cta: isOwner ? "Bayar Pro" : "Pilih Pro",
      ctaTo: "/register" as const,
      features: [
        `${PLAN_LIMITS.pro.maxBranches} cabang`,
        `${PLAN_LIMITS.pro.maxUsers} user`,
        "Semua fitur Basic",
        "Konsolidasi laporan multi-cabang",
      ],
    },
    {
      id: "enterprise" as const,
      name: "Enterprise",
      highlight: false,
      price: formatPlanPrice(
        cycle === "yearly" ? pricing.enterprise.yearly : pricing.enterprise.monthly,
      ),
      period: cycle === "yearly" ? "/ tahun" : "/ bulan",
      desc: "3+ cabang atau skala besar",
      limits: PLAN_LIMITS.enterprise,
      cta: isOwner ? "Bayar Enterprise" : "Hubungi Sales",
      ctaTo: "/register" as const,
      features: [
        "Cabang & user tanpa batas praktis",
        "Prioritas onboarding",
        "SLA & custom integrasi",
        "Account manager dedicated",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-mesh">
      <header className="border-b border-white/10 bg-gradient-sidebar text-white">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold">SEPS</div>
              <div className="text-xs text-white/60">{APP_TAGLINE}</div>
            </div>
          </Link>
          <div className="flex gap-2">
            {isAuthenticated ? (
              <Button asChild variant="ghost" className="text-white hover:bg-white/10">
                <Link to="/">Ke aplikasi</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="text-white hover:bg-white/10">
                  <Link to="/login">Masuk</Link>
                </Button>
                <Button asChild>
                  <Link to="/register">Daftar Trial</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 lg:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="secondary" className="mb-4">
            Trial {TRIAL_DAYS} hari · Tanpa kartu kredit
          </Badge>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
            Satu harga jelas.
            <span className="block text-primary mt-1">Untung toko, bukan tebak-tebakan.</span>
          </h1>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            ERP toko bangunan multi-cabang. Hemat hingga 17% dengan langganan tahunan.
            Pro = 2 cabang & 15 user. Cabang ke-3? Enterprise.
          </p>

          <div className="inline-flex mt-8 p-1 rounded-full bg-muted border">
            <button
              type="button"
              onClick={() => setCycle("yearly")}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                cycle === "yearly" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground",
              )}
            >
              Tahunan — hemat
            </button>
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                cycle === "monthly" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground",
              )}
            >
              Bulanan
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                "p-6 flex flex-col shadow-card relative",
                plan.highlight && "border-primary ring-2 ring-primary/20 scale-[1.02]",
                planFromAd === plan.id && "border-primary ring-2 ring-primary/30",
              )}
            >
              {plan.highlight && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">Paling populer</Badge>
              )}
              <div className="flex items-center gap-2 mb-3">
                <Crown className={cn("h-5 w-5", plan.highlight ? "text-primary" : "text-muted-foreground")} />
                <h2 className="text-lg font-bold">{plan.name}</h2>
              </div>
              <p className="text-sm text-muted-foreground min-h-[40px]">{plan.desc}</p>
              <div className="my-4">
                <span className="text-2xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <ul className="space-y-2 text-sm flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.id === "trial" || !isOwner ? (
                <Button asChild variant={plan.highlight ? "default" : "outline"} className="w-full">
                  <Link to={plan.ctaTo}>{plan.cta}</Link>
                </Button>
              ) : (
                <Button
                  variant={plan.highlight ? "default" : "outline"}
                  className="w-full"
                  onClick={() => openCheckout(plan.id)}
                >
                  {plan.cta}
                </Button>
              )}
            </Card>
          ))}
        </div>

        <section className="mt-16 grid lg:grid-cols-2 gap-8">
          <Card className="p-6 shadow-card">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-primary" /> Semua paket berbayar include
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {FEATURES.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6 shadow-card">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-primary" /> Perbandingan limit
            </h3>
            <div className="space-y-3 text-sm">
              {(["basic", "pro", "enterprise"] as const).map((p) => (
                <div key={p} className="flex justify-between border-b pb-2 last:border-0">
                  <span className="font-medium capitalize">{PLAN_LIMITS[p].label}</span>
                  <span className="text-muted-foreground flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {PLAN_LIMITS[p].maxBranches >= 999 ? "∞" : PLAN_LIMITS[p].maxBranches}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {PLAN_LIMITS[p].maxUsers >= 999 ? "∞" : PLAN_LIMITS[p].maxUsers}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Trial mengikuti limit Pro ({PLAN_LIMITS.trial.maxBranches} cabang, {PLAN_LIMITS.trial.maxUsers}{" "}
              user) selama {TRIAL_DAYS} hari.
            </p>
          </Card>
        </section>

        <p className="text-center text-xs text-muted-foreground mt-12">
          Harga belum termasuk PPN. Pembayaran otomatis via Midtrans Snap (QRIS/VA/e-wallet).
          <br />
          Pertanyaan? WhatsApp tim SEPS atau daftar trial dulu — kami bantu onboarding.
        </p>
      </main>

      {isOwner ? (
        <UpgradePlanSheet
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          initialPlan={checkoutPlan}
          initialCycle={cycle}
        />
      ) : null}
    </div>
  );
}

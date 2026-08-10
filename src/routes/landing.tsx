import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Package,
  Receipt,
  ShieldCheck,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-branding";
import {
  formatPlanPrice,
  PLAN_LIMITS,
  PLAN_PRICING,
  TRIAL_DAYS,
} from "@/lib/plan-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      {
        title: `${APP_NAME} — ERP Toko Bangunan yang Rapikan Kas, Stok & Piutang`,
      },
      {
        name: "description",
        content:
          "SEPS menyatukan POS, stok, piutang, dan laporan multi-cabang untuk toko bangunan. Coba 7 hari gratis, atau bayar paket langsung via Midtrans.",
      },
      { property: "og:title", content: `${APP_NAME} — Sistem toko bangunan yang menutup kebocoran omzet` },
      {
        property: "og:description",
        content:
          "Dari kasir sampai laporan owner. Trial 7 hari atau aktifkan paket berbayar otomatis setelah bayar.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap",
      },
    ],
  }),
  component: LandingPage,
});

function useReveal() {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, visible };
}

function LandingPage() {
  return (
    <div className="lp min-h-screen bg-[var(--lp-bg)] text-[var(--lp-ink)] antialiased">
      <style>{LP_CSS}</style>

      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link to="/landing" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--lp-accent)] text-sm font-bold text-white shadow-[0_8px_24px_rgba(16,120,90,0.35)]">
              S
            </span>
            <span className="lp-display text-lg font-bold tracking-tight text-white">{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden text-white/85 hover:bg-white/10 hover:text-white sm:inline-flex">
              <Link to="/login">Masuk</Link>
            </Button>
            <Button asChild className="bg-white text-[var(--lp-ink)] hover:bg-white/90">
              <Link to="/register">
                Coba {TRIAL_DAYS} hari
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO — one composition: brand, headline, support, CTA, full-bleed visual */}
      <section className="lp-hero relative isolate min-h-[100svh] overflow-hidden">
        <div className="lp-hero-bg absolute inset-0" aria-hidden />
        <div className="lp-hero-grain absolute inset-0" aria-hidden />

        <div className="relative mx-auto grid min-h-[100svh] max-w-6xl items-end gap-10 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-20 lg:pt-24">
          <div className="lp-hero-copy max-w-xl text-white">
            <p className="lp-display mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              {APP_NAME}
            </p>
            <h1 className="lp-display text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Tutup kebocoran kas & stok toko bangunan — dalam satu sistem.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
              POS, stok real-time, piutang, dan laporan owner. Aktifkan paket berbayar otomatis
              setelah bayar Midtrans.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="h-12 bg-[var(--lp-accent)] px-6 text-base font-semibold text-white hover:bg-[var(--lp-accent-strong)]"
              >
                <Link to="/register">
                  Mulai trial {TRIAL_DAYS} hari gratis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/35 bg-white/5 px-6 text-base text-white hover:bg-white/12 hover:text-white"
              >
                <Link to="/pricing">Pilih paket & bayar</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-white/55">
              Tanpa kartu kredit untuk trial · Bayar QRIS/VA/GoPay via Midtrans · {APP_TAGLINE}
            </p>
          </div>

          <div className="lp-hero-visual relative mx-auto w-full max-w-md lg:max-w-none">
            <HeroProductVisual />
          </div>
        </div>
      </section>

      <PainSection />
      <SolutionSection />
      <PricingSection />
      <TrustSection />
      <FinalCta />

      <footer className="border-t border-black/5 bg-[#f3eee6] px-4 py-8 text-center text-sm text-[var(--lp-muted)] sm:px-6">
        <p>
          © {new Date().getFullYear()} {APP_NAME} · {APP_TAGLINE}
        </p>
        <div className="mt-2 flex justify-center gap-4">
          <Link to="/login" className="hover:text-[var(--lp-ink)]">
            Masuk
          </Link>
          <Link to="/pricing" className="hover:text-[var(--lp-ink)]">
            Harga
          </Link>
          <Link to="/register" className="hover:text-[var(--lp-ink)]">
            Daftar
          </Link>
        </div>
      </footer>

      {/* Mobile sticky convert bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[#f7f3ec]/95 p-3 backdrop-blur md:hidden">
        <div className="flex gap-2">
          <Button asChild className="h-11 flex-1 bg-[var(--lp-accent)] font-semibold hover:bg-[var(--lp-accent-strong)]">
            <Link to="/register">Trial gratis</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 flex-1 border-[var(--lp-ink)]/20 font-semibold">
            <Link to="/pricing">Bayar paket</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function HeroProductVisual() {
  return (
    <div className="lp-float relative aspect-[4/5] w-full overflow-hidden rounded-[1.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.55)] sm:aspect-[5/4] lg:aspect-[4/5]">
      <img
        src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=80"
        alt="Operasional gudang dan material bangunan"
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0c1a14]/90 via-[#0c1a14]/25 to-transparent" />
      <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-[#0f1f18]/75 p-4 text-white backdrop-blur-md sm:inset-x-5 sm:bottom-5 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Hari ini</p>
            <p className="lp-display mt-1 text-2xl font-bold">Rp 18,4 jt</p>
            <p className="text-sm text-white/65">Omzet konsolidasi 2 cabang</p>
          </div>
          <div className="rounded-xl bg-[var(--lp-accent)]/20 px-3 py-2 text-right">
            <p className="text-[11px] text-emerald-200/90">Stok kritis</p>
            <p className="font-semibold text-emerald-100">3 SKU</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-lg bg-white/8 px-2 py-2">
            <Store className="mx-auto mb-1 h-3.5 w-3.5 text-white/70" />
            POS
          </div>
          <div className="rounded-lg bg-white/8 px-2 py-2">
            <Package className="mx-auto mb-1 h-3.5 w-3.5 text-white/70" />
            Stok
          </div>
          <div className="rounded-lg bg-white/8 px-2 py-2">
            <Wallet className="mx-auto mb-1 h-3.5 w-3.5 text-white/70" />
            Piutang
          </div>
        </div>
      </div>
    </div>
  );
}

function PainSection() {
  const { ref, visible } = useReveal();
  const pains = [
    {
      title: "Kasir jalan, stok bohong",
      body: "Barang sudah laku di counter, gudang masih nulis manual. Selisih muncul saat opname — uang hilang tanpa jejak.",
    },
    {
      title: "Piutang tenggelam di chat",
      body: "Tempo customer dicatat di WA/buku. Jatuh tempo lewat, owner baru sadar saat cashflow macet.",
    },
    {
      title: "Cabang jalan sendiri-sendiri",
      body: "Excel beda format, laporan malam dilapor besok. Keputusan lambat, kebocoran sudah terjadi.",
    },
  ];

  return (
    <section
      ref={ref}
      className={cn("lp-section px-4 py-20 sm:px-6 sm:py-24", visible && "lp-in")}
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--lp-accent-strong)]">
          Masalah yang mahal
        </p>
        <h2 className="lp-display mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Bukan kurang kerja keras. Sistemnya yang bocor.
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {pains.map((p) => (
            <div key={p.title} className="lp-rise border-t border-[var(--lp-ink)]/15 pt-5">
              <h3 className="lp-display text-xl font-bold">{p.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--lp-muted)]">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SolutionSection() {
  const { ref, visible } = useReveal();
  const items = [
    {
      icon: Receipt,
      title: "POS siap tempo & multi-bayar",
      body: "Tunai, transfer, QRIS, tempo — struk rapi, stok potong otomatis (atau SO/indent bila perlu).",
    },
    {
      icon: Package,
      title: "Stok per cabang, real-time",
      body: "Transfer antar gudang, opname, alert kritis. Cocok material & barang curah multi-satuan.",
    },
    {
      icon: TrendingUp,
      title: "Owner lihat angka yang benar",
      body: "Dashboard omzet, margin, piutang, hutang — tanpa nunggu rekap manual malam hari.",
    },
    {
      icon: ShieldCheck,
      title: "Bayar → paket aktif otomatis",
      body: "Pilih Basic/Pro/Enterprise, bayar Midtrans Snap, webhook mengaktifkan langganan. Tanpa tunggu WA admin.",
    },
  ];

  return (
    <section
      ref={ref}
      className={cn(
        "lp-section relative overflow-hidden bg-[#12261e] px-4 py-20 text-[#f4f0e8] sm:px-6 sm:py-24",
        visible && "lp-in",
      )}
    >
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-[var(--lp-accent)]/20 blur-3xl" />
      <div className="relative mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--lp-accent)]">
          Solusi {APP_NAME}
        </p>
        <h2 className="lp-display mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Satu aplikasi untuk kasir, gudang, dan keputusan owner.
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
          Dibangun khusus operasional toko bangunan — bukan ERP generik yang ribet diisi sendiri.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.title} className="lp-rise flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--lp-accent)]/20 text-[var(--lp-accent)]">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="lp-display text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const { ref, visible } = useReveal();
  const plans = [
    {
      id: "basic" as const,
      name: "Basic",
      desc: "Toko tunggal — kasir + stok rapi",
      highlight: false,
    },
    {
      id: "pro" as const,
      name: "Pro",
      desc: "2 cabang · paling dipilih owner berkembang",
      highlight: true,
    },
    {
      id: "enterprise" as const,
      name: "Enterprise",
      desc: "Cabang ke-3+ atau skala besar",
      highlight: false,
    },
  ];

  return (
    <section
      ref={ref}
      id="paket"
      className={cn("lp-section px-4 py-20 sm:px-6 sm:py-24", visible && "lp-in")}
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--lp-accent-strong)]">
            Harga jelas → bayar → aktif
          </p>
          <h2 className="lp-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Closing tanpa drama invoice manual.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--lp-muted)]">
            Trial {TRIAL_DAYS} hari dulu, atau langsung pilih paket. Pembayaran Midtrans (QRIS, VA,
            e-wallet) — paket aktif otomatis setelah lunas.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "lp-rise flex flex-col rounded-2xl border p-6",
                plan.highlight
                  ? "border-[var(--lp-accent)] bg-[#12261e] text-[#f4f0e8] shadow-[0_24px_50px_-28px_rgba(16,120,90,0.55)]"
                  : "border-black/10 bg-white",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="lp-display text-2xl font-bold">{plan.name}</h3>
                {plan.highlight ? (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--lp-accent)]">
                    Populer
                  </span>
                ) : null}
              </div>
              <p className={cn("mt-2 text-sm", plan.highlight ? "text-white/65" : "text-[var(--lp-muted)]")}>
                {plan.desc}
              </p>
              <p className="mt-5">
                <span className="lp-display text-3xl font-bold">
                  {formatPlanPrice(PLAN_PRICING[plan.id].monthly)}
                </span>
                <span className={cn("text-sm", plan.highlight ? "text-white/55" : "text-[var(--lp-muted)]")}>
                  {" "}
                  /bulan
                </span>
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className={cn("mt-0.5 h-4 w-4 shrink-0", plan.highlight ? "text-[var(--lp-accent)]" : "text-[var(--lp-accent-strong)]")} />
                  {PLAN_LIMITS[plan.id].maxBranches >= 999
                    ? "Cabang tanpa batas praktis"
                    : `${PLAN_LIMITS[plan.id].maxBranches} cabang`}
                </li>
                <li className="flex gap-2">
                  <Check className={cn("mt-0.5 h-4 w-4 shrink-0", plan.highlight ? "text-[var(--lp-accent)]" : "text-[var(--lp-accent-strong)]")} />
                  {PLAN_LIMITS[plan.id].maxUsers >= 999
                    ? "User tanpa batas praktis"
                    : `${PLAN_LIMITS[plan.id].maxUsers} user`}
                </li>
                <li className="flex gap-2">
                  <Check className={cn("mt-0.5 h-4 w-4 shrink-0", plan.highlight ? "text-[var(--lp-accent)]" : "text-[var(--lp-accent-strong)]")} />
                  POS · stok · piutang · laporan
                </li>
              </ul>
              <Button
                asChild
                className={cn(
                  "mt-8 h-11 w-full font-semibold",
                  plan.highlight
                    ? "bg-[var(--lp-accent)] text-white hover:bg-[var(--lp-accent-strong)]"
                    : "bg-[var(--lp-ink)] text-white hover:bg-black",
                )}
              >
                <Link to="/pricing" search={{ plan: plan.id }}>
                  Bayar {plan.name} sekarang
                </Link>
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-[var(--lp-muted)]">
          Belum siap bayar?{" "}
          <Link to="/register" className="font-semibold text-[var(--lp-accent-strong)] underline-offset-2 hover:underline">
            Daftar trial {TRIAL_DAYS} hari
          </Link>{" "}
          — tanpa kartu kredit.
        </p>
      </div>
    </section>
  );
}

function TrustSection() {
  const { ref, visible } = useReveal();
  return (
    <section
      ref={ref}
      className={cn(
        "lp-section border-y border-black/5 bg-[#efe8dc] px-4 py-16 sm:px-6",
        visible && "lp-in",
      )}
    >
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
        {[
          {
            t: "Untuk toko bangunan",
            d: "Alur kasir, material, tempo, dan multi-cabang — bukan template ERP kantoran.",
          },
          {
            t: "Pembayaran lokal",
            d: "Midtrans Snap: QRIS, VA bank, GoPay. Paket aktif setelah settlement — tanpa admin SQL.",
          },
          {
            t: "Owner tetap kendali",
            d: "Limit cabang/user per paket jelas. Upgrade di app saat bisnis tumbuh.",
          },
        ].map((x) => (
          <div key={x.t} className="lp-rise">
            <h3 className="lp-display text-lg font-bold">{x.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">{x.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  const { ref, visible } = useReveal();
  return (
    <section
      ref={ref}
      className={cn(
        "lp-section px-4 py-20 pb-28 sm:px-6 sm:py-24 md:pb-24",
        visible && "lp-in",
      )}
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="lp-display text-3xl font-bold tracking-tight sm:text-4xl">
          Malam ini masih rekap Excel — atau sudah lihat omzet live?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--lp-muted)]">
          Mulai trial gratis, atau langsung closing paket Pro. Satu klik bayar, sistem yang
          mengaktifkan.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-12 bg-[var(--lp-accent)] px-8 text-base font-semibold hover:bg-[var(--lp-accent-strong)]"
          >
            <Link to="/register">
              Coba {APP_NAME} {TRIAL_DAYS} hari
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 border-[var(--lp-ink)]/20 px-8 text-base">
            <Link to="/pricing">Lihat harga & bayar</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

const LP_CSS = `
  .lp {
    --lp-bg: #f7f3ec;
    --lp-ink: #142019;
    --lp-muted: #5c685f;
    --lp-accent: #1f8f6a;
    --lp-accent-strong: #0f6b4d;
    font-family: "Figtree", ui-sans-serif, system-ui, sans-serif;
  }
  .lp-display {
    font-family: "Syne", "Figtree", ui-sans-serif, system-ui, sans-serif;
  }
  .lp-hero-bg {
    background:
      radial-gradient(ellipse 80% 60% at 70% 20%, rgba(31, 143, 106, 0.35), transparent 55%),
      radial-gradient(ellipse 50% 40% at 15% 80%, rgba(20, 60, 45, 0.5), transparent 50%),
      linear-gradient(145deg, #0b1612 0%, #143028 42%, #0e1c16 100%);
  }
  .lp-hero-grain {
    opacity: 0.35;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
    mix-blend-mode: overlay;
  }
  .lp-hero-copy {
    animation: lp-fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .lp-hero-visual {
    animation: lp-fade-up 1.05s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
  }
  .lp-float {
    animation: lp-float 7s ease-in-out infinite;
  }
  .lp-section .lp-rise {
    opacity: 0;
    transform: translateY(18px);
    transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .lp-section.lp-in .lp-rise {
    opacity: 1;
    transform: none;
  }
  .lp-section.lp-in .lp-rise:nth-child(2) { transition-delay: 0.08s; }
  .lp-section.lp-in .lp-rise:nth-child(3) { transition-delay: 0.16s; }
  .lp-section.lp-in .lp-rise:nth-child(4) { transition-delay: 0.24s; }
  @keyframes lp-fade-up {
    from { opacity: 0; transform: translateY(22px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes lp-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .lp-hero-copy, .lp-hero-visual, .lp-float { animation: none; }
    .lp-section .lp-rise { opacity: 1; transform: none; transition: none; }
  }
`;

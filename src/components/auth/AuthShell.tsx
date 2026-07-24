import type { ReactNode } from "react";
import { Sparkles, Shield, Zap, TrendingUp } from "lucide-react";
import { APP_TAGLINE } from "@/lib/app-branding";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen flex bg-gradient-mesh">
      <div className="hidden lg:flex flex-1 bg-gradient-sidebar text-white p-12 flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-mesh opacity-50" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xl font-bold">SEPS</div>
            <div className="text-xs text-white/60">{APP_TAGLINE}</div>
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-md">
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Stok, transaksi, untung rugi
            <span className="block bg-gradient-to-r from-primary-glow to-accent-foreground bg-clip-text text-transparent">
              — semua di satu layar.
            </span>
          </h1>
          <p className="text-white/70 leading-relaxed mb-8">
            Sistem ERP yang dirancang khusus untuk toko bangunan modern. Kasir tidak bisa curang,
            stok tidak lagi misteri, dan owner tahu untung berapa setiap hari.
          </p>

          <div className="space-y-3">
            {[
              { icon: Shield, text: "Setiap transaksi tercatat atas nama kasirnya" },
              { icon: Zap, text: "Stok kritis & piutang jatuh tempo auto-notifikasi" },
              { icon: TrendingUp, text: "Laporan laba rugi update real-time setiap hari" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white/10 grid place-items-center">
                  <f.icon className="h-4 w-4 text-primary-glow" />
                </div>
                <span className="text-sm text-white/85">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/40">
          © 2026 SEPS
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative z-0">
        <div className="w-full max-w-sm relative z-10">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="text-lg font-bold">SEPS</div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>

          <div className="mt-7">{children}</div>

          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-background px-2 text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

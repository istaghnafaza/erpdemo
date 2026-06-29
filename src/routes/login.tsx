import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, roleLabel } from "@/lib/auth";
import { USERS, STORE } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sparkles, Shield, Zap, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Masuk — Simetri ERP Store" },
      { name: "description", content: "Masuk ke sistem ERP toko bangunan Simetri." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, login, loginAs } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      navigate({ to: user.role === "kasir" ? "/pos" : "/dashboard" });
    }
  }, [user, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = login(username.trim(), password);
    if (!u) {
      toast.error("Username atau password salah");
      return;
    }
    toast.success(`Selamat datang, ${u.name}`);
    navigate({ to: u.role === "kasir" ? "/pos" : "/dashboard" });
  };

  return (
    <div className="min-h-screen flex bg-gradient-mesh">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-sidebar text-white p-12 flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-mesh opacity-50" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xl font-bold">Simetri ERP</div>
            <div className="text-xs text-white/60">Store Edition</div>
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
          © 2026 Simetri ERP — Mode demo presentasi
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="text-lg font-bold">Simetri ERP</div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Masuk ke sistem</h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            {STORE.name} — {STORE.branch}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="contoh: budi"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90 shadow-glow h-11">
              Masuk
            </Button>
          </form>

          <div className="mt-6">
            <div className="text-xs text-muted-foreground mb-2 text-center">Atau masuk cepat sebagai (demo):</div>
            <div className="grid grid-cols-3 gap-2">
              {USERS.map((u) => (
                <Card
                  key={u.id}
                  onClick={() => {
                    loginAs(u.role);
                    toast.success(`Masuk sebagai ${u.name}`);
                    navigate({ to: u.role === "kasir" ? "/pos" : "/dashboard" });
                  }}
                  className="p-3 cursor-pointer hover:shadow-card hover:border-primary transition-all text-center"
                >
                  <div className="h-9 w-9 rounded-full bg-gradient-primary text-white mx-auto grid place-items-center text-xs font-bold">
                    {u.avatar}
                  </div>
                  <div className="text-xs font-medium mt-2 truncate">{u.name.split(" ")[0]}</div>
                  <div className="text-[10px] text-muted-foreground">{roleLabel(u.role)}</div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

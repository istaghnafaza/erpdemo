import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthDivider, AuthShell } from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { GoogleOAuthRedirectHint } from "@/components/auth/GoogleOAuthRedirectHint";
import { useAuthStore, type MockRole, MOCK_USER_ID_PREFIX } from "@/stores/auth.store";
import { roleLabel, initials } from "@/types/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolvePostAuthDestination } from "@/lib/auth-navigate";
import { redirectIfAuthenticated, syncAuthFromServer } from "@/lib/auth-bootstrap";
import { isNeonBackend } from "@/lib/api/backend";
import { isDemoQuickLoginEnabled } from "@/lib/mock-session";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    await syncAuthFromServer();
    const authedRedirect = redirectIfAuthenticated();
    if (authedRedirect) throw authedRedirect;
  },
  head: () => ({
    meta: [
      { title: "Masuk — SEPS" },
      { name: "description", content: "Masuk ke sistem ERP toko bangunan Simetri." },
    ],
  }),
  component: LoginPage,
});

const DEMO_TENANT_SLUG = "toko-simetri";

const QUICK_LOGIN_OPTIONS: { role: MockRole; name: string; buttonLabel: string }[] = [
  { role: "owner", name: "Budi Santoso", buttonLabel: "Login sebagai Owner" },
  { role: "manager", name: "Siti Rahma", buttonLabel: "Login sebagai Manager" },
  { role: "cashier", name: "Andi Pratama", buttonLabel: "Login sebagai Kasir" },
];

function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const loginAsMock = useAuthStore((s) => s.loginAsMock);
  const loginWithMockCredentials = useAuthStore((s) => s.loginWithMockCredentials);
  const isLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const showQuickLogin = isDemoQuickLoginEnabled();
  const showNeonLogin = isNeonBackend();

  const goToMockApp = (role: MockRole) => {
    navigate({
      to: role === "cashier" ? "/$tenantSlug/pos" : "/$tenantSlug/dashboard",
      params: { tenantSlug: DEMO_TENANT_SLUG },
    });
  };

  const goToApp = async (role: MockRole | "owner" | "manager" | "cashier" | "warehouse" | "accountant") => {
    if (showNeonLogin && !useAuthStore.getState().currentUser?.id.startsWith(MOCK_USER_ID_PREFIX)) {
      const dest = await resolvePostAuthDestination(role);
      navigate(dest);
      return;
    }
    goToMockApp(role as MockRole);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    let ok = loginWithMockCredentials(trimmedEmail, password);
    if (!ok && showNeonLogin) {
      ok = await login(trimmedEmail, password);
    }
    if (!ok) {
      const err = useAuthStore.getState().error ?? "Email atau PIN/password salah";
      toast.error(
        err.includes("DATABASE_URL")
          ? "Login Neon belum siap (DATABASE_URL). Pakai tombol demo Owner/Manager/Kasir di atas, atau isi Variables di Railway lalu Redeploy."
          : err,
      );
      return;
    }
    const { currentUser } = useAuthStore.getState();
    toast.success(`Selamat datang, ${currentUser?.profile.name}`);
    await goToApp(currentUser!.profile.role);
  };

  const handleQuickLogin = async (role: MockRole, name: string) => {
    loginAsMock(role);
    toast.success(`Masuk sebagai ${name} (demo mock)`);
    goToMockApp(role);
  };

  return (
    <AuthShell
      title="Masuk ke sistem"
      subtitle="Kelola toko bangunan Anda dari satu dashboard"
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Daftar gratis
          </Link>
        </p>
      }
    >
      <p className="text-sm mb-4">
        <a
          href="/toko-simetri/shop"
          className="text-primary font-medium hover:underline inline-flex items-center gap-1"
        >
          Order online sebagai pelanggan →
        </a>
      </p>

      {showQuickLogin ? (
        <div className="mb-6">
          <AuthDivider label="Masuk cepat demo (mock — tanpa database)" />
          <div className="space-y-2">
            {QUICK_LOGIN_OPTIONS.map((u) => (
              <Button
                key={u.role}
                type="button"
                variant="outline"
                onClick={() => handleQuickLogin(u.role, u.name)}
                className="w-full justify-start gap-3 h-11"
              >
                <div className="h-7 w-7 rounded-full bg-gradient-primary text-white grid place-items-center text-[10px] font-bold shrink-0">
                  {initials(u.name)}
                </div>
                <span className="flex-1 text-left">{u.buttonLabel}</span>
                <span className="text-[10px] text-muted-foreground">{roleLabel(u.role)}</span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {showNeonLogin ? (
        <>
          <GoogleSignInButton mode="login" />
          <GoogleOAuthRedirectHint />
          <AuthDivider label="Atau masuk dengan email (Neon)" />
        </>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="contoh: budi@simetri.id"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password / PIN</Label>
          <Input
            id="password"
            type="password"
            placeholder={showNeonLogin ? "Password akun Neon" : "PIN 6 digit (demo pegawai)"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-primary hover:opacity-90 shadow-glow h-11"
        >
          {isLoading ? "Memproses..." : "Masuk"}
        </Button>
      </form>

      {showNeonLogin && !showQuickLogin ? (
        <p className="mt-4 text-xs text-muted-foreground text-center">
          Demo seed: <strong>budi@simetri.id</strong> / <strong>DemoSES2025!</strong>
        </p>
      ) : null}
    </AuthShell>
  );
}

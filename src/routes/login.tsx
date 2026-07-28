import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthDivider, AuthShell } from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { GoogleOAuthRedirectHint } from "@/components/auth/GoogleOAuthRedirectHint";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolvePostAuthDestination } from "@/lib/auth-navigate";
import { redirectIfAuthenticated, syncAuthFromServer } from "@/lib/auth-bootstrap";
import { isNeonBackend, isMockBackend } from "@/lib/api/backend";

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

function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const loginWithMockCredentials = useAuthStore((s) => s.loginWithMockCredentials);
  const isLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const showNeonLogin = isNeonBackend();
  const showMockCredentials = isMockBackend();

  const goToApp = async (role: Parameters<typeof resolvePostAuthDestination>[0]) => {
    const dest = await resolvePostAuthDestination(role);
    navigate(dest);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    let ok = false;
    if (showNeonLogin) {
      ok = await login(trimmedEmail, password);
    } else if (showMockCredentials) {
      ok = loginWithMockCredentials(trimmedEmail, password);
    }

    if (!ok) {
      const err = useAuthStore.getState().error ?? "Email atau password salah";
      toast.error(
        err.includes("DATABASE_URL")
          ? "Database belum terhubung. Pastikan DATABASE_URL sudah diisi di Railway, lalu Redeploy."
          : err,
      );
      return;
    }

    const { currentUser } = useAuthStore.getState();
    toast.success(`Selamat datang, ${currentUser?.profile.name}`);
    await goToApp(currentUser!.profile.role);
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

      {showNeonLogin ? (
        <>
          <GoogleSignInButton mode="login" />
          <GoogleOAuthRedirectHint />
          <AuthDivider label="Atau masuk dengan email" />
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
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder={showNeonLogin ? "Password akun Anda" : "PIN 6 digit (demo lokal)"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
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

      {showNeonLogin ? (
        <p className="mt-4 text-xs text-muted-foreground text-center">
          Akun demo: <strong>budi@simetri.id</strong> / <strong>DemoSES2025!</strong>
        </p>
      ) : null}
    </AuthShell>
  );
}

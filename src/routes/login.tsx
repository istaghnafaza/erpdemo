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
import { preparePublicAuthRouteSync } from "@/lib/auth-bootstrap";
import { usePublicAuthRedirect } from "@/hooks/usePublicAuthRedirect";
import { isMockBackend, isNeonBackend } from "@/lib/api/backend";
import { AUTH_UI } from "@/lib/auth-features";
import { FEATURE_ONLINE_ORDERS_ENABLED } from "@/lib/feature-flags";
import { validateLoginForm } from "@/lib/validation/login-form";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    const authedRedirect = preparePublicAuthRouteSync();
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
  usePublicAuthRedirect();
  const login = useAuthStore((s) => s.login);
  const loginWithMockCredentials = useAuthStore((s) => s.loginWithMockCredentials);
  const isLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const showNeonLogin = isNeonBackend();
  const showMockCredentials = isMockBackend();

  const goToApp = async (role: Parameters<typeof resolvePostAuthDestination>[0]) => {
    const dest = await resolvePostAuthDestination(role);
    navigate(dest);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const parsed = validateLoginForm({ username, password });
    if (!parsed.success) {
      const errs: { username?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "username" || key === "password") {
          errs[key] = issue.message;
        }
      }
      setFieldErrors(errs);
      toast.error(AUTH_UI.loginWithUsername ? "Periksa username dan PIN" : "Periksa email dan PIN");
      return;
    }

    const { username: trimmedUsername, password: trimmedPassword } = parsed.data;

    let ok = false;
    if (showNeonLogin) {
      ok = await login(trimmedUsername, trimmedPassword);
    } else if (showMockCredentials) {
      ok = loginWithMockCredentials(trimmedUsername, trimmedPassword);
    }

    if (!ok) {
      const err = useAuthStore.getState().error ?? "Username atau PIN salah";
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

  const loginLabel = AUTH_UI.loginWithUsername ? "Username" : "Email";
  const loginPlaceholder = AUTH_UI.loginWithUsername
    ? "contoh: owner"
    : "contoh: owner@seps.id";

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
          {" · "}
          <Link to="/pricing" className="text-primary font-medium hover:underline">
            Lihat harga
          </Link>
        </p>
      }
    >
      {FEATURE_ONLINE_ORDERS_ENABLED ? (
        <p className="text-sm mb-4">
          <a
            href="/toko-simetri/shop"
            className="text-primary font-medium hover:underline inline-flex items-center gap-1"
          >
            Order online sebagai pelanggan →
          </a>
        </p>
      ) : null}

      {showNeonLogin && AUTH_UI.showGoogleAuth ? (
        <>
          <GoogleSignInButton mode="login" />
          <GoogleOAuthRedirectHint />
          <AuthDivider label="Atau masuk dengan username" />
        </>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="username">{loginLabel}</Label>
          <Input
            id="username"
            type="text"
            inputMode={AUTH_UI.loginWithUsername ? "text" : "email"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={loginPlaceholder}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (fieldErrors.username) setFieldErrors((p) => ({ ...p, username: undefined }));
            }}
            autoComplete="username"
            maxLength={254}
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={fieldErrors.username ? "username-error" : undefined}
          />
          {fieldErrors.username ? (
            <p id="username-error" className="text-xs text-destructive">
              {fieldErrors.username}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">PIN (6 digit)</Label>
          <Input
            id="password"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="6 digit angka"
            value={password}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
              setPassword(digits);
              if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
            }}
            autoComplete="current-password"
            maxLength={6}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
          />
          {fieldErrors.password ? (
            <p id="password-error" className="text-xs text-destructive">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-primary hover:opacity-90 shadow-glow h-11"
        >
          {isLoading ? "Memproses..." : "Masuk"}
        </Button>
      </form>
    </AuthShell>
  );
}

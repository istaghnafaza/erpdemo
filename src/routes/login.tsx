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
import { validateLoginForm } from "@/lib/validation/login-form";

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
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const showNeonLogin = isNeonBackend();
  const showMockCredentials = isMockBackend();

  const goToApp = async (role: Parameters<typeof resolvePostAuthDestination>[0]) => {
    const dest = await resolvePostAuthDestination(role);
    navigate(dest);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const parsed = validateLoginForm({ email, password });
    if (!parsed.success) {
      const errs: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" || key === "password") {
          errs[key] = issue.message;
        }
      }
      setFieldErrors(errs);
      toast.error("Periksa email dan password");
      return;
    }

    const { email: trimmedEmail, password: trimmedPassword } = parsed.data;

    let ok = false;
    if (showNeonLogin) {
      ok = await login(trimmedEmail, trimmedPassword);
    } else if (showMockCredentials) {
      ok = loginWithMockCredentials(trimmedEmail, trimmedPassword);
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

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="contoh: owner@seps.id"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
            }}
            autoComplete="username"
            maxLength={254}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
          />
          {fieldErrors.email ? (
            <p id="email-error" className="text-xs text-destructive">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password (PIN, maks. 6 digit)</Label>
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

      {showNeonLogin ? (
        <p className="mt-4 text-xs text-muted-foreground text-center">
          Contoh: <strong>owner@seps.id</strong> / <strong>111111</strong>
        </p>
      ) : null}
    </AuthShell>
  );
}

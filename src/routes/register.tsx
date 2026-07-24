import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthDivider, AuthShell } from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { GoogleOAuthRedirectHint } from "@/components/auth/GoogleOAuthRedirectHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolvePostAuthDestination } from "@/lib/auth-navigate";
import { isNeonBackend } from "@/lib/api/backend";
import { useAuthStore } from "@/stores/auth.store";
import { redirectIfAuthenticated, syncAuthFromServer } from "@/lib/auth-bootstrap";

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    await syncAuthFromServer();
    const authedRedirect = redirectIfAuthenticated();
    if (authedRedirect) throw authedRedirect;
  },
  head: () => ({
    meta: [
      { title: "Daftar — SEPS" },
      { name: "description", content: "Buat akun baru SEPS." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const goAfterAuth = async (isNewUser?: boolean) => {
    const { currentUser, currentTenant } = useAuthStore.getState();
    if (!currentUser) return;

    if (isNewUser || !currentTenant?.onboarding_complete) {
      toast.success(`Selamat datang, ${currentUser.profile.name}! Lanjut setup toko.`);
      navigate({ to: "/onboarding" });
      return;
    }

    toast.success(`Selamat datang, ${currentUser.profile.name}`);
    const dest = await resolvePostAuthDestination(currentUser.profile.role);
    navigate(dest);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNeonBackend()) {
      toast.error("Registrasi memerlukan VITE_DATA_BACKEND=neon");
      return;
    }

    const ok = await register({
      name,
      businessName,
      email,
      phone: phone.trim() || undefined,
      password,
      confirmPassword,
    });

    if (!ok) {
      toast.error(useAuthStore.getState().error ?? "Registrasi gagal");
      return;
    }

    await goAfterAuth(true);
  };

  return (
    <AuthShell
      title="Buat akun baru"
      subtitle="Daftar sebagai owner toko — trial 14 hari gratis"
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Masuk
          </Link>
        </p>
      }
    >
      <GoogleSignInButton mode="register" />
      <GoogleOAuthRedirectHint />

      <AuthDivider label="Atau daftar dengan email" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nama lengkap</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Budi Santoso"
            autoComplete="name"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="businessName">Nama bisnis / toko</Label>
          <Input
            id="businessName"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Contoh: Toko Bangunan Jaya"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telepon (opsional)</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            autoComplete="tel"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimal 8 karakter"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Konfirmasi password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ulangi password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-primary hover:opacity-90 shadow-glow h-11"
        >
          {isLoading ? "Memproses..." : "Daftar"}
        </Button>
      </form>
    </AuthShell>
  );
}

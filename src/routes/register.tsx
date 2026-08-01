import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthDivider, AuthShell } from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { GoogleOAuthRedirectHint } from "@/components/auth/GoogleOAuthRedirectHint";
import {
  EMPTY_OWNER_ADDRESS,
  IndonesiaAddressFields,
  type OwnerAddressValue,
} from "@/components/address/IndonesiaAddressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isNeonBackend } from "@/lib/api/backend";
import { AUTH_UI } from "@/lib/auth-features";
import { resolvePostAuthDestination } from "@/lib/auth-navigate";
import { validateRegisterForm } from "@/lib/validation/register-form";
import { useAuthStore } from "@/stores/auth.store";
import { useOnboardingStore } from "@/stores/onboarding.store";
import { preparePublicAuthRoute } from "@/lib/auth-bootstrap";

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    const authedRedirect = await preparePublicAuthRoute();
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
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState<OwnerAddressValue>(EMPTY_OWNER_ADDRESS);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const goAfterAuth = async () => {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser) return;

    useOnboardingStore.getState().resetOnboarding();
    toast.success(`Selamat datang, ${currentUser.profile.name}!`);
    const dest = await resolvePostAuthDestination(currentUser.profile.role);
    navigate(dest);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    if (!isNeonBackend()) {
      toast.error("Registrasi memerlukan VITE_DATA_BACKEND=neon");
      return;
    }

    const parsed = validateRegisterForm({
      name,
      username,
      email,
      phone,
      address,
      password,
      confirmPassword,
    });

    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path;
        const key =
          path.length === 0
            ? "form"
            : path[0] === "address" && path[1]
              ? String(path[1])
              : String(path[0] ?? "form");
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      toast.error(parsed.error.issues[0]?.message ?? "Periksa formulir daftar");
      return;
    }

    const ok = await register(parsed.data);

    if (!ok) {
      toast.error(useAuthStore.getState().error ?? "Registrasi gagal");
      return;
    }

    await goAfterAuth();
  };

  const setPin = (value: string, field: "password" | "confirmPassword") => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    if (field === "password") setPassword(digits);
    else setConfirmPassword(digits);
    if (fieldErrors[field]) {
      setFieldErrors((p) => {
        const next = { ...p };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <AuthShell
      title="Buat akun baru"
      subtitle="Daftar akun owner — setup toko bisa dilakukan dari menu modul"
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Masuk
          </Link>
          {" · "}
          <Link to="/pricing" className="text-primary font-medium hover:underline">
            Lihat harga
          </Link>
        </p>
      }
    >
      {AUTH_UI.showGoogleAuth ? (
        <>
          <GoogleSignInButton mode="register" />
          <GoogleOAuthRedirectHint />
          <AuthDivider label="Atau daftar dengan username" />
        </>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
          {fieldErrors.name ? (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
            placeholder="contoh: budi.toko"
            autoComplete="username"
            autoCapitalize="none"
            maxLength={32}
            required
          />
          <p className="text-xs text-muted-foreground">
            Dipakai untuk masuk ke sistem. Huruf, angka, titik, strip.
          </p>
          {fieldErrors.username ? (
            <p className="text-xs text-destructive">{fieldErrors.username}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email (opsional)</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            autoComplete="email"
          />
          {fieldErrors.email ? (
            <p className="text-xs text-destructive">{fieldErrors.email}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">
            Telepon <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            autoComplete="tel"
            required
          />
          {fieldErrors.phone ? (
            <p className="text-xs text-destructive">{fieldErrors.phone}</p>
          ) : null}
        </div>

        <IndonesiaAddressFields
          value={address}
          onChange={setAddress}
          errors={{
            provinceCode: fieldErrors.provinceCode,
            regencyCode: fieldErrors.regencyCode,
            districtCode: fieldErrors.districtCode,
            villageCode: fieldErrors.villageCode,
            street: fieldErrors.street,
          }}
        />

        <div className="space-y-1.5">
          <Label htmlFor="password">PIN (6 digit)</Label>
          <Input
            id="password"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={password}
            onChange={(e) => setPin(e.target.value, "password")}
            placeholder="6 digit angka"
            autoComplete="new-password"
            maxLength={6}
            required
          />
          {fieldErrors.password ? (
            <p className="text-xs text-destructive">{fieldErrors.password}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Konfirmasi PIN</Label>
          <Input
            id="confirmPassword"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={confirmPassword}
            onChange={(e) => setPin(e.target.value, "confirmPassword")}
            placeholder="Ulangi PIN 6 digit"
            autoComplete="new-password"
            maxLength={6}
            required
          />
          {fieldErrors.confirmPassword ? (
            <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
          ) : null}
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

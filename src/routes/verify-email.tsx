import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { isNeonBackend } from "@/lib/api/backend";
import { resendRegistrationOtp } from "@/lib/api/auth";
import { resolvePostAuthDestination } from "@/lib/auth-navigate";
import { preparePublicAuthRouteSync, waitForAuthHydration } from "@/lib/auth-bootstrap";
import { usePublicAuthRedirect } from "@/hooks/usePublicAuthRedirect";
import { useAuthStore } from "@/stores/auth.store";
import { useOnboardingStore } from "@/stores/onboarding.store";
import { z } from "zod";

const verifySearchSchema = z.object({
  challengeId: z.string().optional(),
  email: z.string().optional(),
  debugOtp: z.string().optional(),
});

export const Route = createFileRoute("/verify-email")({
  validateSearch: verifySearchSchema,
  beforeLoad: async () => {
    await waitForAuthHydration();
    const authedRedirect = preparePublicAuthRouteSync();
    if (authedRedirect) throw authedRedirect;
  },
  head: () => ({
    meta: [
      { title: "Verifikasi Email — SEPS" },
      { name: "description", content: "Verifikasi email untuk mengaktifkan akun SEPS." },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const authGate = usePublicAuthRedirect();
  const navigate = useNavigate();
  const completeEmailVerification = useAuthStore((s) => s.completeEmailVerification);
  const { challengeId: initialChallengeId, email: initialEmail, debugOtp: initialDebugOtp } =
    Route.useSearch();

  const [challengeId, setChallengeId] = useState(initialChallengeId ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [destinationHint, setDestinationHint] = useState(
    initialEmail ? maskEmailHint(initialEmail) : "",
  );
  const [otp, setOtp] = useState(initialDebugOtp ?? "");
  const [busy, setBusy] = useState(false);

  const goAfterAuth = async () => {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser) return;

    useOnboardingStore.getState().resetOnboarding();
    toast.success(`Selamat datang, ${currentUser.profile.name}!`);
    const dest = await resolvePostAuthDestination(currentUser.profile.role);
    navigate(dest);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNeonBackend()) {
      toast.error("Verifikasi memerlukan koneksi server (Neon).");
      return;
    }
    if (!challengeId) {
      toast.error("Sesi verifikasi tidak ditemukan. Daftar ulang atau minta kode baru.");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      toast.error("Kode OTP harus 6 digit");
      return;
    }

    setBusy(true);
    const ok = await completeEmailVerification(challengeId, otp);
    setBusy(false);

    if (!ok) {
      toast.error(useAuthStore.getState().error ?? "Verifikasi gagal");
      return;
    }

    await goAfterAuth();
  };

  const handleResend = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Isi email yang didaftarkan.");
      return;
    }
    setBusy(true);
    const result = await resendRegistrationOtp(trimmed);
    setBusy(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? "Gagal mengirim ulang kode");
      return;
    }
    setChallengeId(result.data.challengeId);
    setDestinationHint(result.data.destinationHint);
    if (result.data.debugOtp) setOtp(result.data.debugOtp);
    toast.success(
      result.data.debugOtp
        ? "Mode development: kode OTP ditampilkan di layar."
        : `Kode dikirim ke ${result.data.destinationHint}. Cek juga folder spam.`,
    );
  };

  if (authGate !== "guest") {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        {authGate === "leaving" ? "Menyambung sesi…" : "Memuat…"}
      </div>
    );
  }

  return (
    <AuthShell
      title="Verifikasi email"
      subtitle="Masukkan kode 6 digit yang dikirim ke email Anda untuk mengaktifkan akun"
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Sudah verifikasi?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Masuk
          </Link>
        </p>
      }
    >
      <form onSubmit={handleConfirm} className="space-y-4" noValidate>
        {destinationHint ? (
          <p className="text-sm text-muted-foreground text-center">
            Kode dikirim ke <strong>{destinationHint}</strong>
          </p>
        ) : null}

        {initialDebugOtp ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 text-center">
            Mode development — OTP: <strong>{initialDebugOtp}</strong>
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="otp">Kode OTP</Label>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>

        <Button
          type="submit"
          disabled={busy}
          className="w-full bg-gradient-primary hover:opacity-90 shadow-glow h-11"
        >
          {busy ? "Memverifikasi…" : "Aktifkan akun"}
        </Button>
      </form>

      <div className="mt-6 pt-4 border-t space-y-3">
        <p className="text-sm text-muted-foreground text-center">Belum terima kode?</p>
        <div className="space-y-1.5">
          <Label htmlFor="resend-email">Email terdaftar</Label>
          <Input
            id="resend-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            autoComplete="email"
          />
        </div>
        <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={handleResend}>
          Kirim ulang kode
        </Button>
      </div>
    </AuthShell>
  );
}

function maskEmailHint(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.slice(0, 1)}***@${domain}`;
}

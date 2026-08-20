import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { isNeonBackend } from "@/lib/api/backend";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/api/auth";
import { AUTH_UI } from "@/lib/auth-features";
import { preparePublicAuthRouteSync, waitForAuthHydration } from "@/lib/auth-bootstrap";
import { usePublicAuthRedirect } from "@/hooks/usePublicAuthRedirect";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: async () => {
    if (!AUTH_UI.showForgotPassword) {
      throw redirect({ to: "/login" });
    }
    await waitForAuthHydration();
    const authedRedirect = preparePublicAuthRouteSync();
    if (authedRedirect) throw authedRedirect;
  },
  head: () => ({
    meta: [
      { title: "Lupa PIN — SEPS" },
      { name: "description", content: "Reset PIN login SEPS lewat email atau OTP SMS." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const authGate = usePublicAuthRedirect();
  const navigate = useNavigate();
  const showNeon = isNeonBackend();

  const [step, setStep] = useState<"request" | "confirm" | "done">("request");
  const [identifier, setIdentifier] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [challengeId, setChallengeId] = useState("");
  const [destinationHint, setDestinationHint] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | undefined>();
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  const idLabel = AUTH_UI.loginWithUsername ? "Username, email, atau nomor HP" : "Email atau nomor HP";

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showNeon) {
      toast.error("Reset PIN memerlukan koneksi server (Neon).");
      return;
    }
    const trimmed = identifier.trim();
    if (trimmed.length < 3) {
      toast.error("Isi username, email, atau nomor HP yang terdaftar.");
      return;
    }
    setBusy(true);
    const result = await requestPasswordReset(trimmed, channel);
    setBusy(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? "Gagal mengirim kode");
      return;
    }
    setChallengeId(result.data.challengeId);
    setDestinationHint(result.data.destinationHint);
    setDebugOtp(result.data.debugOtp);
    setOtp(result.data.debugOtp ?? "");
    setStep("confirm");
    toast.success(
      result.data.debugOtp
        ? "Mode development: kode OTP ditampilkan di layar (belum ada Resend/Twilio)."
        : `Jika akun ditemukan, kode dikirim ke ${result.data.destinationHint}. Cek juga folder spam.`,
    );
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      toast.error("Kode OTP harus 6 digit");
      return;
    }
    if (!/^\d{6}$/.test(newPin)) {
      toast.error("PIN baru harus 6 digit angka");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("Konfirmasi PIN tidak sama");
      return;
    }
    setBusy(true);
    const result = await confirmPasswordReset(challengeId, otp, newPin);
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setStep("done");
    toast.success("PIN berhasil diganti. Silakan masuk.");
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
      title="Lupa PIN"
      subtitle="Kami kirim kode konfirmasi ke email atau nomor HP, lalu Anda bisa membuat PIN baru."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Ingat PIN-nya?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Kembali masuk
          </Link>
        </p>
      }
    >
      {step === "request" ? (
        <form onSubmit={handleRequest} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="identifier">{idLabel}</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={AUTH_UI.loginWithUsername ? "username atau email" : "email@toko.com"}
            />
          </div>
          <div className="space-y-2">
            <Label>Kirim kode lewat</Label>
            <RadioGroup
              value={channel}
              onValueChange={(v) => setChannel(v as "email" | "sms")}
              className="gap-3"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="email" id="ch-email" />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="sms" id="ch-sms" />
                OTP SMS / WhatsApp ke nomor HP
              </label>
            </RadioGroup>
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-primary hover:opacity-90 shadow-glow h-11"
          >
            {busy ? "Mengirim…" : "Kirim kode"}
          </Button>
        </form>
      ) : null}

      {step === "confirm" ? (
        <form onSubmit={handleConfirm} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Masukkan kode 6 digit yang dikirim ke <span className="font-medium text-foreground">{destinationHint}</span>
            . Kode berlaku 10 menit.
          </p>
          {debugOtp ? (
            <p className="text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2">
              Development: kode OTP <strong className="tracking-widest">{debugOtp}</strong>
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label>Kode OTP</Label>
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
          <div className="space-y-1.5">
            <Label htmlFor="new-pin">PIN baru (6 digit)</Label>
            <Input
              id="new-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pin">Ulangi PIN baru</Label>
            <Input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoComplete="new-password"
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-primary hover:opacity-90 shadow-glow h-11"
          >
            {busy ? "Menyimpan…" : "Simpan PIN baru"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:underline"
            onClick={() => {
              setStep("request");
              setOtp("");
              setNewPin("");
              setConfirmPin("");
              setDebugOtp(undefined);
            }}
          >
            Kirim ulang / ganti metode
          </button>
        </form>
      ) : null}

      {step === "done" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">PIN sudah diganti. Masuk dengan PIN baru.</p>
          <Button
            className="w-full bg-gradient-primary hover:opacity-90 shadow-glow h-11"
            onClick={() => navigate({ to: "/login" })}
          >
            Ke halaman masuk
          </Button>
        </div>
      ) : null}
    </AuthShell>
  );
}

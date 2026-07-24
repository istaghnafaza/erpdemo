import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  consumeGoogleOAuthMode,
  consumeGoogleOAuthState,
  getGoogleOAuthRedirectUri,
} from "@/lib/google-auth-client";
import { resolvePostAuthDestination } from "@/lib/auth-navigate";
import { useAuthStore } from "@/stores/auth.store";

type GoogleCallbackSearch = {
  code?: string;
  state?: string;
  error?: string;
};

export const Route = createFileRoute("/auth/google/callback")({
  validateSearch: (search: Record<string, unknown>): GoogleCallbackSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  // Jangan pasang syncAuth/redirect di sini — OAuth callback menangani navigasi sendiri
  head: () => ({
    meta: [{ title: "Login Google — SEPS" }],
  }),
  component: GoogleCallbackPage,
});

function GoogleCallbackPage() {
  const navigate = useNavigate();
  const completeGoogleOAuth = useAuthStore((s) => s.completeGoogleOAuth);
  const { code, state, error } = Route.useSearch();
  const [message, setMessage] = useState("Menyelesaikan login Google...");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function finish() {
      if (error) {
        const redirectUri = getGoogleOAuthRedirectUri();
        if (error === "redirect_uri_mismatch") {
          toast.error(
            `redirect_uri_mismatch — tambahkan URI ini di Google Console: ${redirectUri}`,
            { duration: 12000 },
          );
        } else {
          toast.error(`Google OAuth: ${error}`);
        }
        navigate({ to: "/login" });
        return;
      }

      if (!code) {
        toast.error("Kode OAuth tidak ditemukan");
        navigate({ to: "/login" });
        return;
      }

      if (!consumeGoogleOAuthState(state)) {
        toast.error("Sesi OAuth tidak valid. Silakan coba lagi.");
        navigate({ to: "/login" });
        return;
      }

      const mode = consumeGoogleOAuthMode();
      setMessage("Membuat sesi...");

      const result = await completeGoogleOAuth(code, getGoogleOAuthRedirectUri());
      if (!result.ok) {
        toast.error(useAuthStore.getState().error ?? "Login Google gagal");
        navigate({ to: mode === "register" ? "/register" : "/login" });
        return;
      }

      const { currentUser } = useAuthStore.getState();
      if (result.isNewUser) {
        toast.success(`Selamat datang, ${currentUser?.profile.name}! Lanjut setup toko.`);
        navigate({ to: "/onboarding" });
        return;
      }

      toast.success(`Selamat datang, ${currentUser?.profile.name}`);
      const dest = await resolvePostAuthDestination(currentUser?.profile.role ?? "owner");
      navigate(dest);
    }

    void finish();
  }, [code, state, error, completeGoogleOAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  getGoogleOAuthRedirectUri,
  getPublicAppOrigin,
  isGoogleAuthEnabled,
  isGoogleOAuthOriginSupported,
  isLocalNetworkAccess,
} from "@/lib/google-auth-client";

/** Petunjuk setup Google Console + batasan IP LAN */
export function GoogleOAuthRedirectHint() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isGoogleAuthEnabled()) return null;

  const redirectUri = getGoogleOAuthRedirectUri();
  const origin = getPublicAppOrigin();
  const onLan = isLocalNetworkAccess() && !import.meta.env.VITE_PUBLIC_APP_URL;
  const supported = isGoogleOAuthOriginSupported();

  if (onLan) {
    return (
      <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        <p className="font-medium text-destructive">
          Login Google tidak bisa via IP WiFi (192.168.x.x)
        </p>
        <p className="mt-1">
          Google Cloud <strong>menolak</strong> IP lokal di redirect URI — hanya{" "}
          <code className="text-[10px]">localhost</code> atau domain publik (ngrok / production).
        </p>
        <p className="mt-2 font-medium">Opsi untuk iPad/iPhone:</p>
        <ul className="mt-1 list-disc pl-4 space-y-1">
          <li>
            <strong>Daftar/login dengan email</strong> — tetap jalan via WiFi (
            <code className="text-[10px]">{window.location.origin}</code>)
          </li>
          <li>
            <strong>ngrok</strong>: <code className="text-[10px]">ngrok http 8081</code> → daftar URL
            ngrok di Google Console → buka link ngrok di iPhone
          </li>
          <li>Login Google di PC: <code className="text-[10px]">http://localhost:8081</code></li>
        </ul>
      </div>
    );
  }

  if (!supported) return null;

  return (
    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      <p className="font-medium text-amber-800 dark:text-amber-200">
        Google Console — daftarkan URI berikut
      </p>
      <p className="mt-1">
        <strong>Authorized redirect URIs:</strong>
      </p>
      <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-[10px] select-all">
        {redirectUri}
      </code>
      <p className="mt-2">
        <strong>Authorized JavaScript origins:</strong>
      </p>
      <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-[10px] select-all">
        {origin}
      </code>
      <p className="mt-2 text-[10px]">
        Hanya <code>localhost</code> atau domain publik — jangan pakai IP 192.168.x.x (Google menolak).
      </p>
    </div>
  );
}

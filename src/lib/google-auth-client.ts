// =============================================================================
// Google OAuth redirect — client helper (same tab, no popup)
// =============================================================================

const STATE_KEY = "ses_google_oauth_state";
const MODE_KEY = "ses_google_oauth_mode";

export type GoogleOAuthMode = "login" | "register";

function randomState(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function storeOAuthSession(state: string, mode: GoogleOAuthMode) {
  try {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(MODE_KEY, mode);
  } catch {
    // iOS private mode / storage blocked — state check skipped on callback
  }
}

export function getPublicAppOrigin(): string {
  const override = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  if (override?.trim()) return override.trim().replace(/\/$/, "");
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

/** Google OAuth hanya mendukung localhost atau domain publik (bukan IP LAN). */
export function isGoogleOAuthOriginSupported(): boolean {
  const origin = getPublicAppOrigin();
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    // domain publik (ngrok, production)
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

export function isLocalNetworkAccess(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return /^\d+\.\d+\.\d+\.\d+$/.test(h) && h !== "127.0.0.1";
}

export function getGoogleOAuthRedirectUri(): string {
  return `${getPublicAppOrigin()}/auth/google/callback`;
}

export function isGoogleAuthEnabled(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

/** Build Google OAuth URL (sets sessionStorage state). Returns null if misconfigured. */
export function buildGoogleOAuthUrl(mode: GoogleOAuthMode): string | null {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return null;

  const redirectUri = getGoogleOAuthRedirectUri();
  const state = randomState();
  storeOAuthSession(state, mode);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Redirect full page ke Google — same tab (reliable on iOS Safari). */
export function redirectToGoogleOAuth(mode: GoogleOAuthMode): boolean {
  const url = buildGoogleOAuthUrl(mode);
  if (!url) return false;
  window.location.href = url;
  return true;
}

export function consumeGoogleOAuthState(receivedState: string | undefined): boolean {
  try {
    const expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    if (!expected || !receivedState) return true; // storage blocked on mobile
    return expected === receivedState;
  } catch {
    return true;
  }
}

export function consumeGoogleOAuthMode(): GoogleOAuthMode {
  try {
    const mode = sessionStorage.getItem(MODE_KEY);
    sessionStorage.removeItem(MODE_KEY);
    return mode === "register" ? "register" : "login";
  } catch {
    return "login";
  }
}

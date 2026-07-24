// =============================================================================
// Google OAuth — authorization code flow (redirect, no popup)
// =============================================================================

import { OAuth2Client } from "google-auth-library";
import type { GoogleTokenPayload } from "@/server/auth/google";

function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID ?? "";
}

function getGoogleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

/** Must match Google Console → Authorized redirect URIs */
export function getGoogleOAuthRedirectUri(): string {
  const base = process.env.AUTH_URL ?? "http://localhost:8081";
  return `${base.replace(/\/$/, "")}/auth/google/callback`;
}

export function isGoogleOAuthServerConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export async function exchangeGoogleAuthCode(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenPayload> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth belum lengkap. Set GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di .env",
    );
  }

  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new Error("Google tidak mengembalikan id_token");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Profil Google tidak valid");
  }
  if (payload.email_verified === false) {
    throw new Error("Email Google belum terverifikasi");
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified !== false,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}

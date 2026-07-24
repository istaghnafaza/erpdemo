// =============================================================================
// Google ID token verification (server-only)
// =============================================================================

import { OAuth2Client } from "google-auth-library";

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

function getGoogleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID;
  if (!id) {
    throw new Error("GOOGLE_CLIENT_ID belum dikonfigurasi. Tambahkan ke .env");
  }
  return id;
}

export async function verifyGoogleIdToken(credential: string): Promise<GoogleTokenPayload> {
  const client = new OAuth2Client(getGoogleClientId());
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: getGoogleClientId(),
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Token Google tidak valid");
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

export function isGoogleAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID);
}

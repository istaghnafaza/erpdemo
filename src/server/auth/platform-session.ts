// =============================================================================
// Platform admin session helpers
// =============================================================================

import type { SessionPayload } from "@/server/auth/session";
import { getRequestSession, requireRequestSession } from "@/server/auth/request-session";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { authUsers } from "@/server/db/schema";

export async function isPlatformAdminUser(userId: string): Promise<boolean> {
  const db = getDb();
  const row = await db.query.authUsers.findFirst({
    where: eq(authUsers.id, userId),
    columns: { isPlatformAdmin: true },
  });
  return row?.isPlatformAdmin === true;
}

export function sessionIsPlatformAdmin(session: SessionPayload): boolean {
  return session.isPlatformAdmin === true;
}

export async function requirePlatformAdminSession(): Promise<SessionPayload> {
  const session = await requireRequestSession();
  if (!sessionIsPlatformAdmin(session)) {
    const ok = await isPlatformAdminUser(session.sub);
    if (!ok) throw new Error("Akses platform admin ditolak");
  }
  return session;
}

export async function getOptionalPlatformSession(): Promise<SessionPayload | null> {
  return getRequestSession();
}

// =============================================================================
// Read session from incoming request (server-only)
// =============================================================================

import { getRequestHeader } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { profiles } from "@/server/db/schema";
import { parseSessionCookie, verifySessionToken, type SessionPayload } from "@/server/auth/session";
import type { DbUserRole } from "@/types/database";

export async function getRequestSession(): Promise<SessionPayload | null> {
  const cookie = getRequestHeader("cookie");
  const fromCookie = parseSessionCookie(cookie);
  if (fromCookie) {
    const session = await verifySessionToken(fromCookie);
    if (session) return session;
  }

  const auth = getRequestHeader("authorization");
  if (auth?.startsWith("Bearer ")) {
    return verifySessionToken(auth.slice(7));
  }

  return null;
}

export async function requireRequestSession(): Promise<SessionPayload> {
  const session = await getRequestSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export function assertTenant(session: SessionPayload, tenantId: string): void {
  if (session.tenantId !== tenantId) {
    throw new Error("Tenant access denied");
  }
}

export async function assertTenantRoles(
  session: SessionPayload,
  tenantId: string,
  allowedRoles: DbUserRole[],
): Promise<void> {
  assertTenant(session, tenantId);
  const db = getDb();
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, session.sub), eq(profiles.tenantId, tenantId), eq(profiles.isActive, true)),
  });
  if (!profile || !allowedRoles.includes(profile.role)) {
    throw new Error("Akses ditolak");
  }
}

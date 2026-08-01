// =============================================================================
// Platform admin bootstrap — create/update developer account from env
// =============================================================================

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { authUsers } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { readEnv } from "@/server/env";

export interface PlatformAdminSeedResult {
  created: boolean;
  updated: boolean;
  username: string;
  email: string;
}

export async function ensurePlatformAdminFromEnv(): Promise<PlatformAdminSeedResult | null> {
  const username = readEnv("PLATFORM_ADMIN_USERNAME")?.trim().toLowerCase();
  const password = readEnv("PLATFORM_ADMIN_PASSWORD");
  const email = readEnv("PLATFORM_ADMIN_EMAIL")?.trim().toLowerCase();
  const displayName = readEnv("PLATFORM_ADMIN_NAME")?.trim();

  if (!username || !password || !email) {
    return null;
  }

  const db = getDb();
  const passwordHash = await hashPassword(password);

  const existingByUsername = await db.query.authUsers.findFirst({
    where: sql`lower(${authUsers.username}) = ${username}`,
  });

  if (existingByUsername) {
    await db
      .update(authUsers)
      .set({
        email,
        passwordHash,
        isPlatformAdmin: true,
        tenantId: null,
      })
      .where(eq(authUsers.id, existingByUsername.id));

    return {
      created: false,
      updated: true,
      username,
      email,
    };
  }

  const existingByEmail = await db.query.authUsers.findFirst({
    where: eq(authUsers.email, email),
  });
  if (existingByEmail) {
    await db
      .update(authUsers)
      .set({
        username,
        passwordHash,
        isPlatformAdmin: true,
        tenantId: null,
      })
      .where(eq(authUsers.id, existingByEmail.id));

    return {
      created: false,
      updated: true,
      username,
      email,
    };
  }

  await db.insert(authUsers).values({
    id: crypto.randomUUID(),
    email,
    username,
    passwordHash,
    googleSub: null,
    tenantId: null,
    isPlatformAdmin: true,
  });

  return {
    created: true,
    updated: false,
    username,
    email: email,
  };
}

export function getPlatformAdminDisplayName(username: string, email: string): string {
  const fromEnv = readEnv("PLATFORM_ADMIN_NAME")?.trim();
  if (fromEnv) return fromEnv;
  return username || email.split("@")[0] || "Platform Admin";
}

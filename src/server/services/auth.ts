// =============================================================================
// Auth service — Neon/Drizzle
// =============================================================================

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { toProfile } from "@/server/db/mappers";
import { authUsers, profiles, userBranches } from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/password";
import { createSessionToken } from "@/server/auth/session";
import { getPlatformAdminDisplayName } from "@/server/services/platform-admin";
import type { AuthUser, AppProfile } from "@/types/app";
import type { Profile, ProfileUpdate } from "@/types/database";

function buildAuthUser(profile: Profile, branchIds: string[]): AuthUser {
  return {
    id: profile.id,
    email: profile.email,
    tenantId: profile.tenant_id,
    isPlatformAdmin: false,
    profile: {
      id: profile.id,
      tenantId: profile.tenant_id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      pin: profile.pin,
      isActive: profile.is_active,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    },
    activeBranchId: branchIds[0] ?? null,
    allowedBranchIds: branchIds,
    isOwner: profile.role === "owner",
    isManager: profile.role === "manager",
    isCashier: profile.role === "cashier",
    isWarehouse: profile.role === "warehouse",
    isAccountant: profile.role === "accountant",
  };
}

function buildPlatformAuthUser(authRow: {
  id: string;
  email: string;
  username: string | null;
}): AuthUser {
  const name = getPlatformAdminDisplayName(authRow.username ?? "", authRow.email);
  const now = new Date().toISOString();
  return {
    id: authRow.id,
    email: authRow.email,
    tenantId: "",
    isPlatformAdmin: true,
    profile: {
      id: authRow.id,
      tenantId: "",
      name,
      email: authRow.email,
      role: "owner",
      pin: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    activeBranchId: null,
    allowedBranchIds: [],
    isOwner: false,
    isManager: false,
    isCashier: false,
    isWarehouse: false,
    isAccountant: false,
  };
}

async function getBranchIdsForUser(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ branchId: userBranches.branchId })
    .from(userBranches)
    .where(eq(userBranches.userId, userId));
  return rows.map((r) => r.branchId);
}

async function findAuthUserByLoginId(loginId: string) {
  const db = getDb();
  const trimmed = loginId.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    return (
      (await db.query.authUsers.findFirst({
        where: eq(authUsers.email, trimmed),
      })) ?? null
    );
  }

  const byUsername = await db.query.authUsers.findFirst({
    where: sql`lower(${authUsers.username}) = ${trimmed}`,
  });
  if (byUsername) return byUsername;

  const byEmailLocal = await db.query.authUsers.findFirst({
    where: sql`lower(split_part(${authUsers.email}, '@', 1)) = ${trimmed}`,
  });
  return byEmailLocal ?? null;
}

export async function signInWithPassword(
  loginId: string,
  password: string,
): Promise<{ user: AuthUser; token: string } | null> {
  const authRow = await findAuthUserByLoginId(loginId);
  if (!authRow) return null;

  const valid = await verifyPassword(password, authRow.passwordHash);
  if (!valid) return null;

  if (authRow.isPlatformAdmin) {
    const user = buildPlatformAuthUser(authRow);
    const token = await createSessionToken({
      sub: authRow.id,
      email: authRow.email,
      tenantId: "",
      isPlatformAdmin: true,
    });
    return { user, token };
  }

  const db = getDb();
  const profileRow = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, authRow.id), eq(profiles.isActive, true)),
  });
  if (!profileRow) return null;

  const profile = toProfile(profileRow);
  const branchIds = await getBranchIdsForUser(profile.id);
  const token = await createSessionToken({
    sub: profile.id,
    email: profile.email,
    tenantId: profile.tenant_id,
  });

  return { user: buildAuthUser(profile, branchIds), token };
}

export async function getUserBySession(userId: string): Promise<AuthUser | null> {
  const db = getDb();
  const authRow = await db.query.authUsers.findFirst({
    where: eq(authUsers.id, userId),
  });
  if (!authRow) return null;

  if (authRow.isPlatformAdmin) {
    return buildPlatformAuthUser(authRow);
  }

  const profileRow = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, userId), eq(profiles.isActive, true)),
  });
  if (!profileRow) return null;

  const profile = toProfile(profileRow);
  const branchIds = await getBranchIdsForUser(profile.id);
  return buildAuthUser(profile, branchIds);
}

export async function signInWithPin(
  tenantId: string,
  email: string,
  pin: string,
): Promise<AppProfile | null> {
  const db = getDb();
  const profileRow = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.tenantId, tenantId),
      eq(profiles.email, email.toLowerCase().trim()),
      eq(profiles.pin, pin),
      eq(profiles.isActive, true),
    ),
  });
  if (!profileRow) return null;

  const p = toProfile(profileRow);
  return {
    id: p.id,
    tenantId: p.tenant_id,
    name: p.name,
    email: p.email,
    role: p.role,
    pin: p.pin,
    isActive: p.is_active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<Profile, "name" | "pin">>,
): Promise<AppProfile | null> {
  const db = getDb();
  const patch: Partial<typeof profiles.$inferInsert> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.pin !== undefined) patch.pin = updates.pin;

  const [row] = await db
    .update(profiles)
    .set(patch)
    .where(eq(profiles.id, userId))
    .returning();
  if (!row) return null;

  const p = toProfile(row);
  return {
    id: p.id,
    tenantId: p.tenant_id,
    name: p.name,
    email: p.email,
    role: p.role,
    pin: p.pin,
    isActive: p.is_active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

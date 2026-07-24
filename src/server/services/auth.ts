// =============================================================================
// Auth service — Neon/Drizzle
// =============================================================================

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { toProfile } from "@/server/db/mappers";
import { authUsers, profiles, userBranches } from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/password";
import { createSessionToken } from "@/server/auth/session";
import type { AuthUser, AppProfile } from "@/types/app";
import type { Profile, ProfileUpdate } from "@/types/database";

function buildAuthUser(profile: Profile, branchIds: string[]): AuthUser {
  return {
    id: profile.id,
    email: profile.email,
    tenantId: profile.tenant_id,
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

async function getBranchIdsForUser(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ branchId: userBranches.branchId })
    .from(userBranches)
    .where(eq(userBranches.userId, userId));
  return rows.map((r) => r.branchId);
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ user: AuthUser; token: string } | null> {
  const db = getDb();
  const authRow = await db.query.authUsers.findFirst({
    where: eq(authUsers.email, email.toLowerCase().trim()),
  });
  if (!authRow) return null;

  const valid = await verifyPassword(password, authRow.passwordHash);
  if (!valid) return null;

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

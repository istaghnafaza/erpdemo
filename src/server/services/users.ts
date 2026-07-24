// =============================================================================
// Users service — Neon/Drizzle
// =============================================================================

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { toProfile } from "@/server/db/mappers";
import { authUsers, profiles, userBranches } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import type { CreateTenantUserInput, TenantUserRecord, UpdateTenantUserInput } from "@/types/app";
import type { Profile } from "@/types/database";

function profileToRecord(p: Profile, branchIds: string[]): TenantUserRecord {
  return {
    id: p.id,
    tenantId: p.tenant_id,
    name: p.name,
    email: p.email,
    role: p.role,
    pin: p.pin ?? "",
    branchIds,
    isActive: p.is_active,
    isProtected: p.role === "owner",
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function listTenantUsers(tenantId: string): Promise<TenantUserRecord[]> {
  const db = getDb();
  const profileRows = await db.query.profiles.findMany({
    where: eq(profiles.tenantId, tenantId),
    orderBy: asc(profiles.name),
  });

  const branchRows = await db
    .select({ userId: userBranches.userId, branchId: userBranches.branchId })
    .from(userBranches)
    .where(eq(userBranches.tenantId, tenantId));

  const branchMap = new Map<string, string[]>();
  for (const row of branchRows) {
    const list = branchMap.get(row.userId) ?? [];
    list.push(row.branchId);
    branchMap.set(row.userId, list);
  }

  return profileRows.map((row) => {
    const p = toProfile(row);
    return profileToRecord(p, branchMap.get(p.id) ?? []);
  });
}

const DEFAULT_PASSWORD = "DemoSES2025!";

export async function createTenantUser(
  tenantId: string,
  input: CreateTenantUserInput,
): Promise<TenantUserRecord> {
  const db = getDb();
  const userId = crypto.randomUUID();
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.pin || DEFAULT_PASSWORD);

  await db.insert(authUsers).values({
    id: userId,
    email,
    passwordHash,
    tenantId,
  });

  const [profileRow] = await db
    .insert(profiles)
    .values({
      id: userId,
      tenantId,
      name: input.name.trim(),
      email,
      role: input.role,
      pin: input.pin,
      isActive: true,
    })
    .returning();

  for (const branchId of input.branchIds) {
    await db.insert(userBranches).values({ userId, branchId, tenantId });
  }

  const p = toProfile(profileRow);
  return profileToRecord(p, input.branchIds);
}

export async function updateTenantUser(
  tenantId: string,
  userId: string,
  input: UpdateTenantUserInput,
): Promise<TenantUserRecord | null> {
  const db = getDb();
  const patch: Partial<typeof profiles.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.email !== undefined) patch.email = input.email.trim().toLowerCase();
  if (input.role !== undefined) patch.role = input.role;
  if (input.pin !== undefined) patch.pin = input.pin;

  const [profileRow] = await db
    .update(profiles)
    .set(patch)
    .where(and(eq(profiles.id, userId), eq(profiles.tenantId, tenantId)))
    .returning();
  if (!profileRow) return null;

  if (input.branchIds) {
    await db.delete(userBranches).where(eq(userBranches.userId, userId));
    for (const branchId of input.branchIds) {
      await db.insert(userBranches).values({ userId, branchId, tenantId });
    }
  }

  const branchRows = await db
    .select({ branchId: userBranches.branchId })
    .from(userBranches)
    .where(eq(userBranches.userId, userId));

  const p = toProfile(profileRow);
  return profileToRecord(
    p,
    branchRows.map((r) => r.branchId),
  );
}

export async function setTenantUserActive(
  tenantId: string,
  userId: string,
  isActive: boolean,
): Promise<TenantUserRecord | null> {
  const db = getDb();
  const [profileRow] = await db
    .update(profiles)
    .set({ isActive })
    .where(and(eq(profiles.id, userId), eq(profiles.tenantId, tenantId)))
    .returning();
  if (!profileRow) return null;

  const branchRows = await db
    .select({ branchId: userBranches.branchId })
    .from(userBranches)
    .where(eq(userBranches.userId, userId));

  const p = toProfile(profileRow);
  return profileToRecord(
    p,
    branchRows.map((r) => r.branchId),
  );
}

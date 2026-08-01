// =============================================================================
// Users service — Neon/Drizzle
// =============================================================================

import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { toProfile } from "@/server/db/mappers";
import { authUsers, profiles, userBranches } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { resolveStaffCredentials } from "@/lib/staff-credentials";
import type { CreateTenantUserInput, TenantUserRecord, UpdateTenantUserInput } from "@/types/app";
import type { Profile } from "@/types/database";

function profileToRecord(p: Profile, branchIds: string[], username: string): TenantUserRecord {
  return {
    id: p.id,
    tenantId: p.tenant_id,
    name: p.name,
    username,
    email: p.email,
    phone: p.phone,
    address: p.address,
    dateOfBirth: p.date_of_birth,
    role: p.role,
    pin: p.pin ?? "",
    branchIds,
    isActive: p.is_active,
    isProtected: p.role === "owner",
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

function validateCreateInput(input: CreateTenantUserInput): void {
  if (!input.name.trim()) throw new Error("Nama wajib diisi");
  if (!input.username?.trim()) throw new Error("Username wajib diisi");
  if (input.role === "owner") throw new Error("Role owner tidak bisa ditambahkan");
  if (!/^\d{6}$/.test(input.pin)) throw new Error("PIN harus 6 digit angka");
  if (input.branchIds.length === 0) throw new Error("Pilih minimal 1 cabang");
}

export async function listTenantUsers(tenantId: string): Promise<TenantUserRecord[]> {
  const db = getDb();
  const rows = await db
    .select({
      profile: profiles,
      username: authUsers.username,
    })
    .from(profiles)
    .innerJoin(authUsers, eq(profiles.id, authUsers.id))
    .where(eq(profiles.tenantId, tenantId))
    .orderBy(asc(profiles.name));

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

  return rows.map(({ profile: row, username }) => {
    const p = toProfile(row);
    return profileToRecord(p, branchMap.get(p.id) ?? [], username);
  });
}

export async function createTenantUser(
  tenantId: string,
  input: CreateTenantUserInput,
): Promise<TenantUserRecord> {
  validateCreateInput(input);

  const { assertCanAddUser } = await import("@/server/services/plan-limits");
  await assertCanAddUser(tenantId);

  const db = getDb();
  const userId = crypto.randomUUID();
  const { email, username } = resolveStaffCredentials({
    name: input.name,
    username: input.username,
    email: input.email,
    userId,
  });

  const existingEmail = await db.query.authUsers.findFirst({ where: eq(authUsers.email, email) });
  if (existingEmail) throw new Error("Email sudah dipakai pegawai lain");

  const existingUsername = await db.query.authUsers.findFirst({
    where: sql`lower(${authUsers.username}) = ${username}`,
  });
  if (existingUsername) throw new Error("Username sudah dipakai pegawai lain");

  const passwordHash = await hashPassword(input.pin);

  await db.insert(authUsers).values({
    id: userId,
    email,
    username,
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
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      dateOfBirth: input.dateOfBirth || null,
      isActive: true,
    })
    .returning();

  for (const branchId of input.branchIds) {
    await db.insert(userBranches).values({ userId, branchId, tenantId });
  }

  const p = toProfile(profileRow);
  return profileToRecord(p, input.branchIds, username);
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
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.address !== undefined) patch.address = input.address?.trim() || null;
  if (input.dateOfBirth !== undefined) patch.dateOfBirth = input.dateOfBirth || null;

  if (input.username !== undefined) {
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      throw new Error("Username 3–32 karakter: huruf, angka, titik, strip, underscore");
    }
    const existingUsername = await db.query.authUsers.findFirst({
      where: and(
        sql`lower(${authUsers.username}) = ${username}`,
        sql`${authUsers.id} <> ${userId}`,
      ),
    });
    if (existingUsername) throw new Error("Username sudah dipakai pegawai lain");
    await db.update(authUsers).set({ username }).where(eq(authUsers.id, userId));
  }

  if (input.pin !== undefined) {
    const passwordHash = await hashPassword(input.pin);
    await db.update(authUsers).set({ passwordHash }).where(eq(authUsers.id, userId));
  }

  if (input.email !== undefined) {
    await db
      .update(authUsers)
      .set({ email: input.email.trim().toLowerCase() })
      .where(eq(authUsers.id, userId));
  }

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

  const authRow = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userId) });
  const p = toProfile(profileRow);
  return profileToRecord(
    p,
    branchRows.map((r) => r.branchId),
    authRow?.username ?? "",
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

  const authRow = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userId) });
  const p = toProfile(profileRow);
  return profileToRecord(
    p,
    branchRows.map((r) => r.branchId),
    authRow?.username ?? "",
  );
}

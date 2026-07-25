// =============================================================================
// Users API — CRUD pegawai tenant
// =============================================================================

import { db, fail, ok, queryMany, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import {
  neonCreateTenantUser,
  neonListTenantUsers,
  neonSetTenantUserActive,
  neonUpdateTenantUser,
} from "@/lib/api/neon/fns";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import { useUsersStore } from "@/stores/users.store";
import type { ApiResponse, CreateTenantUserInput, TenantUserRecord, UpdateTenantUserInput } from "@/types/app";
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

export async function listTenantUsers(tenantId: string): Promise<ApiResponse<TenantUserRecord[]>> {
  if (isMockTenantId(tenantId)) {
    useUsersStore.getState().initForTenant(tenantId);
    return ok(useUsersStore.getState().listForTenant(tenantId));
  }

  if (isNeonBackend()) {
    const result = await neonCall(() => neonListTenantUsers({ data: { tenantId } }));
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }

  try {
    const profiles = await queryMany<Profile>(() =>
      db.from("profiles").select("*").eq("tenant_id", tenantId).order("name"),
    );
    if (profiles.error) return fail(profiles.error);

    const branchRows = await queryMany<{ user_id: string; branch_id: string }>(() =>
      db.from("user_branches").select("user_id, branch_id").eq("tenant_id", tenantId),
    );
    if (branchRows.error) return fail(branchRows.error);

    const branchMap = new Map<string, string[]>();
    for (const row of branchRows.data ?? []) {
      const list = branchMap.get(row.user_id) ?? [];
      list.push(row.branch_id);
      branchMap.set(row.user_id, list);
    }

    return ok((profiles.data ?? []).map((p) => profileToRecord(p, branchMap.get(p.id) ?? [])));
  } catch (err) {
    return fail(err);
  }
}

export async function createTenantUser(
  tenantId: string,
  input: CreateTenantUserInput,
): Promise<ApiResponse<TenantUserRecord>> {
  if (isMockTenantId(tenantId)) {
    const result = useUsersStore.getState().createUser(tenantId, input);
    if (!result.ok || !result.user) return fail(result.error ?? "Gagal menambah pegawai");
    return ok(result.user);
  }

  if (isNeonBackend()) {
    const result = await neonCall(() => neonCreateTenantUser({ data: { tenantId, input } }));
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal menambah pegawai");
    return ok(result.data);
  }

  return fail("Penambahan pegawai memerlukan VITE_DATA_BACKEND=neon");
}

export async function updateTenantUser(
  tenantId: string,
  userId: string,
  input: UpdateTenantUserInput,
): Promise<ApiResponse<TenantUserRecord>> {
  if (isMockTenantId(tenantId)) {
    const result = useUsersStore.getState().updateUser(userId, input);
    if (!result.ok) return fail(result.error ?? "Gagal memperbarui pegawai");
    const updated = useUsersStore.getState().findById(userId);
    if (!updated) return fail("Pegawai tidak ditemukan");
    return ok(updated);
  }

  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateTenantUser({ data: { tenantId, userId, input } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Pegawai tidak ditemukan");
    return ok(result.data);
  }

  return fail("Update pegawai memerlukan VITE_DATA_BACKEND=neon");
}

export async function setTenantUserActive(
  tenantId: string,
  userId: string,
  isActive: boolean,
): Promise<ApiResponse<TenantUserRecord>> {
  if (isMockTenantId(tenantId)) {
    const result = useUsersStore.getState().setActive(userId, isActive);
    if (!result.ok) return fail(result.error ?? "Gagal mengubah status pegawai");
    const updated = useUsersStore.getState().findById(userId);
    if (!updated) return fail("Pegawai tidak ditemukan");
    return ok(updated);
  }

  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonSetTenantUserActive({ data: { tenantId, userId, isActive } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Pegawai tidak ditemukan");
    return ok(result.data);
  }

  return fail("Update status memerlukan VITE_DATA_BACKEND=neon");
}

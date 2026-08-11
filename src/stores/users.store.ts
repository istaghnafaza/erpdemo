// =============================================================================
// Users Store — pegawai tenant (demo/mock persist + CRUD owner).
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import { SEED_TENANT_USERS } from "@/lib/mock-users";
import type {
  CreateTenantUserInput,
  TenantUserRecord,
  UpdateTenantUserInput,
  UserRole,
} from "@/types/app";

interface UsersState {
  users: TenantUserRecord[];

  initForTenant: (tenantId: string) => void;
  listForTenant: (tenantId: string) => TenantUserRecord[];
  findByEmailAndPin: (
    tenantId: string,
    email: string,
    pin: string,
  ) => TenantUserRecord | null;
  /** Username atau email + PIN (demo). */
  findByLoginIdAndPin: (
    tenantId: string,
    loginId: string,
    pin: string,
  ) => TenantUserRecord | null;
  findById: (id: string) => TenantUserRecord | undefined;
  createUser: (tenantId: string, input: CreateTenantUserInput) => { ok: boolean; error?: string; user?: TenantUserRecord };
  updateUser: (id: string, input: UpdateTenantUserInput) => { ok: boolean; error?: string };
  setActive: (id: string, isActive: boolean) => { ok: boolean; error?: string };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function newCustomUserId(): string {
  const suffix = Date.now().toString(16).padStart(12, "0").slice(-12);
  return `33339999-0000-0000-0000-${suffix}`;
}

function validateInput(input: CreateTenantUserInput): string | null {
  if (!input.name.trim()) return "Nama wajib diisi";
  if (!input.username?.trim()) return "Username wajib diisi";
  if (!/^[a-z0-9._-]{3,32}$/.test(input.username.trim().toLowerCase())) {
    return "Username 3–32 karakter: huruf, angka, titik, strip, underscore";
  }
  if (input.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return "Format email tidak valid";
  }
  if (!/^\d{6}$/.test(input.pin)) return "PIN harus 6 digit angka";
  if (input.branchIds.length === 0) return "Pilih minimal 1 cabang";
  if (input.role === "owner") return "Role owner tidak bisa ditambahkan";
  return null;
}

export const useUsersStore = create<UsersState>()(
  persist(
    (set, get) => ({
      users: SEED_TENANT_USERS,

      initForTenant: (tenantId) => {
        if (tenantId !== MOCK_TENANT_ID) return;
        const { users } = get();
        const hasSeed = users.some((u) => u.tenantId === tenantId && u.isProtected);
        if (!hasSeed) {
          set({ users: [...SEED_TENANT_USERS, ...users.filter((u) => u.tenantId !== tenantId)] });
        }
      },

      listForTenant: (tenantId) =>
        get()
          .users.filter((u) => u.tenantId === tenantId)
          .sort((a, b) => a.name.localeCompare(b.name, "id")),

      findByEmailAndPin: (tenantId, email, pin) => {
        const normalized = normalizeEmail(email);
        return (
          get().users.find(
            (u) =>
              u.tenantId === tenantId &&
              normalizeEmail(u.email) === normalized &&
              u.pin === pin.trim() &&
              u.isActive,
          ) ?? null
        );
      },

      findByLoginIdAndPin: (tenantId, loginId, pin) => {
        const trimmedPin = pin.trim();
        const id = loginId.trim();
        return (
          get().users.find(
            (u) =>
              u.tenantId === tenantId &&
              (u.username === id ||
                (id.includes("@") && normalizeEmail(u.email) === id.toLowerCase())) &&
              u.pin === trimmedPin &&
              u.isActive,
          ) ?? null
        );
      },

      findById: (id) => get().users.find((u) => u.id === id),

      createUser: (tenantId, input) => {
        const err = validateInput(input);
        if (err) return { ok: false, error: err };

        const userId = newCustomUserId();
        const username = input.username.trim().toLowerCase();
        const usernameTaken = get().users.some(
          (u) => u.tenantId === tenantId && u.username.toLowerCase() === username,
        );
        if (usernameTaken) return { ok: false, error: "Username sudah dipakai pegawai lain" };

        const normalized = input.email?.trim()
          ? input.email.trim().toLowerCase()
          : `${input.name.trim().toLowerCase().replace(/\s+/g, ".")}.${userId.slice(-8)}@staff.local`;
        const duplicate = get().users.some(
          (u) => u.tenantId === tenantId && u.email.toLowerCase() === normalized,
        );
        if (duplicate) return { ok: false, error: "Email sudah dipakai pegawai lain" };

        const now = new Date().toISOString();
        const user: TenantUserRecord = {
          id: userId,
          tenantId,
          name: input.name.trim(),
          username,
          email: normalized,
          phone: input.phone?.trim() || null,
          address: input.address?.trim() || null,
          dateOfBirth: input.dateOfBirth || null,
          role: input.role,
          pin: input.pin,
          branchIds: input.branchIds,
          isActive: true,
          isProtected: false,
          createdAt: now,
          updatedAt: now,
        };

        set((s) => ({ users: [...s.users, user] }));
        return { ok: true, user };
      },

      updateUser: (id, input) => {
        const existing = get().findById(id);
        if (!existing) return { ok: false, error: "Pegawai tidak ditemukan" };
        if (existing.isProtected && input.role && input.role !== "owner") {
          return { ok: false, error: "Akun pemilik tidak bisa diubah rolenya" };
        }
        if (input.role === "owner" && existing.role !== "owner") {
          return { ok: false, error: "Tidak bisa mengubah pegawai menjadi owner" };
        }
        if (input.pin && !/^\d{6}$/.test(input.pin)) {
          return { ok: false, error: "PIN harus 6 digit angka" };
        }
        if (input.username) {
          const username = input.username.trim().toLowerCase();
          const usernameTaken = get().users.some(
            (u) =>
              u.id !== id &&
              u.tenantId === existing.tenantId &&
              u.username.toLowerCase() === username,
          );
          if (usernameTaken) return { ok: false, error: "Username sudah dipakai pegawai lain" };
        }
        if (input.email) {
          const normalized = normalizeEmail(input.email);
          const duplicate = get().users.some(
            (u) => u.id !== id && u.tenantId === existing.tenantId && normalizeEmail(u.email) === normalized,
          );
          if (duplicate) return { ok: false, error: "Email sudah dipakai pegawai lain" };
        }
        if (input.branchIds && input.branchIds.length === 0) {
          return { ok: false, error: "Pilih minimal 1 cabang" };
        }

        set((s) => ({
          users: s.users.map((u) => {
            if (u.id !== id) return u;
            return {
              ...u,
              name: input.name?.trim() ?? u.name,
              username: input.username?.trim().toLowerCase() ?? u.username,
              email: input.email ? normalizeEmail(input.email) : u.email,
              phone: input.phone !== undefined ? input.phone?.trim() || null : u.phone,
              address: input.address !== undefined ? input.address?.trim() || null : u.address,
              dateOfBirth: input.dateOfBirth !== undefined ? input.dateOfBirth || null : u.dateOfBirth,
              role: (input.role ?? u.role) as UserRole,
              pin: input.pin ?? u.pin,
              branchIds: input.branchIds ?? u.branchIds,
              isActive: input.isActive ?? u.isActive,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
        return { ok: true };
      },

      setActive: (id, isActive) => {
        const existing = get().findById(id);
        if (!existing) return { ok: false, error: "Pegawai tidak ditemukan" };
        if (existing.isProtected && !isActive) {
          return { ok: false, error: "Akun pemilik tidak bisa dinonaktifkan" };
        }
        return get().updateUser(id, { isActive });
      },
    }),
    {
      name: "ses-users",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

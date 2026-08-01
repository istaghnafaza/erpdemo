// =============================================================================
// Mock tenant users — mirrors `supabase/migrations/003_seed_data.sql`.
// =============================================================================

import {
  MOCK_BRANCH_BEKASI,
  MOCK_BRANCH_KEBONJERUK,
  MOCK_BRANCH_SUDIRMAN,
  MOCK_TENANT_ID,
} from "@/lib/mock-ids";
import type { AuthUser, TenantUserRecord, UserRole } from "@/types/app";

const ALL_BRANCHES = [MOCK_BRANCH_SUDIRMAN, MOCK_BRANCH_KEBONJERUK, MOCK_BRANCH_BEKASI];

function seedUser(
  partial: Omit<TenantUserRecord, "phone" | "address" | "dateOfBirth"> &
    Partial<Pick<TenantUserRecord, "phone" | "address" | "dateOfBirth">>,
): TenantUserRecord {
  return {
    phone: null,
    address: null,
    dateOfBirth: null,
    ...partial,
  };
}

export const SEED_TENANT_USERS: TenantUserRecord[] = [
  seedUser({
    id: "33331111-0000-0000-0000-000000000001",
    tenantId: MOCK_TENANT_ID,
    name: "Budi Santoso",
    username: "budi",
    email: "budi@simetri.id",
    role: "owner",
    pin: "000000",
    branchIds: ALL_BRANCHES,
    isActive: true,
    isProtected: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
  seedUser({
    id: "33331111-0000-0000-0000-000000000002",
    tenantId: MOCK_TENANT_ID,
    name: "Siti Rahma",
    username: "siti",
    email: "siti@simetri.id",
    role: "manager",
    pin: "111111",
    branchIds: [MOCK_BRANCH_SUDIRMAN, MOCK_BRANCH_KEBONJERUK],
    isActive: true,
    isProtected: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
  seedUser({
    id: "33331111-0000-0000-0000-000000000003",
    tenantId: MOCK_TENANT_ID,
    name: "Rudi Hermawan",
    username: "rudi",
    email: "rudi@simetri.id",
    role: "manager",
    pin: "555555",
    branchIds: [MOCK_BRANCH_KEBONJERUK, MOCK_BRANCH_BEKASI],
    isActive: true,
    isProtected: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
  seedUser({
    id: "33331111-0000-0000-0000-000000000004",
    tenantId: MOCK_TENANT_ID,
    name: "Andi Pratama",
    username: "andi",
    email: "andi@simetri.id",
    role: "cashier",
    pin: "222222",
    branchIds: [MOCK_BRANCH_SUDIRMAN],
    isActive: true,
    isProtected: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
  seedUser({
    id: "33331111-0000-0000-0000-000000000005",
    tenantId: MOCK_TENANT_ID,
    name: "Dewi Lestari",
    username: "dewi",
    email: "dewi@simetri.id",
    role: "warehouse",
    pin: "333333",
    branchIds: [MOCK_BRANCH_SUDIRMAN],
    isActive: true,
    isProtected: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
];

export function tenantUserToAuthUser(record: TenantUserRecord): AuthUser {
  const role = record.role;
  return {
    id: record.id,
    email: record.email,
    tenantId: record.tenantId,
    profile: {
      id: record.id,
      tenantId: record.tenantId,
      name: record.name,
      email: record.email,
      role,
      pin: record.pin,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    activeBranchId: record.branchIds[0] ?? null,
    allowedBranchIds: record.branchIds,
    isOwner: role === "owner",
    isManager: role === "manager",
    isCashier: role === "cashier",
    isWarehouse: role === "warehouse",
    isAccountant: role === "accountant",
  };
}

export function roleFlags(role: UserRole) {
  return {
    isOwner: role === "owner",
    isManager: role === "manager",
    isCashier: role === "cashier",
    isWarehouse: role === "warehouse",
    isAccountant: role === "accountant",
  };
}

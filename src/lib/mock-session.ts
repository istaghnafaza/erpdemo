// =============================================================================
// Mock demo session — hanya aktif saat VITE_DATA_BACKEND=mock (local dev).
// Production (Neon) selalu memakai database; ID seed sama dengan mock tapi
// backend neon tidak boleh dianggap sesi demo.
// =============================================================================

import { isMockBackend } from "@/lib/api/backend";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import { MOCK_USER_ID_PREFIX } from "@/stores/auth.store";

export function isMockDemoUser(
  user: { id: string; tenantId: string } | null | undefined,
): boolean {
  if (!isMockBackend() || !user) return false;
  return user.tenantId === MOCK_TENANT_ID && user.id.startsWith(MOCK_USER_ID_PREFIX);
}

/** Tenant toko-simetri pakai data mock (localStorage), bukan Neon. */
export function isMockTenantSession(
  tenantId: string | undefined,
  _user?: { id: string; tenantId: string } | null | undefined,
): boolean {
  if (!isMockBackend()) return false;
  return !!tenantId && tenantId === MOCK_TENANT_ID;
}

/** Shortcut — tenant mock hanya saat backend mock. */
export function isMockTenantId(tenantId: string | undefined): boolean {
  return isMockTenantSession(tenantId);
}

// =============================================================================
// Mock demo session — quick login tanpa database (staging / development)
// =============================================================================

import { isMockBackend } from "@/lib/api/backend";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import { MOCK_USER_ID_PREFIX, useAuthStore } from "@/stores/auth.store";

export function isMockDemoUser(
  user: { id: string; tenantId: string } | null | undefined,
): boolean {
  if (!user) return false;
  return user.tenantId === MOCK_TENANT_ID && user.id.startsWith(MOCK_USER_ID_PREFIX);
}

/** Tenant toko-simetri pakai data mock (localStorage), bukan Neon — meski backend neon aktif. */
export function isMockTenantSession(
  tenantId: string | undefined,
  user: { id: string; tenantId: string } | null | undefined,
): boolean {
  if (!tenantId || tenantId !== MOCK_TENANT_ID) return false;
  if (isMockBackend()) return true;
  return isMockDemoUser(user);
}

/** Shortcut — baca user aktif dari auth store. */
export function isMockTenantId(tenantId: string | undefined): boolean {
  return isMockTenantSession(tenantId, useAuthStore.getState().currentUser);
}

/** Tombol "Login sebagai Owner/Manager/Kasir" di halaman login. */
export function isDemoQuickLoginEnabled(): boolean {
  if (isMockBackend()) return true;

  const flag = import.meta.env.VITE_DEMO_QUICK_LOGIN as string | undefined;
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;

  const appEnv = import.meta.env.VITE_APP_ENV as string | undefined;
  return appEnv === "staging" || appEnv === "development";
}

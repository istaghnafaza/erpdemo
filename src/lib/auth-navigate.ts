// =============================================================================
// Post-auth navigation helper
// =============================================================================

import { getTenant } from "@/lib/api/tenants";
import { isNeonBackend } from "@/lib/api/backend";
import { useAuthStore } from "@/stores/auth.store";
import type { Tenant } from "@/types/database";

export function getPlatformDashboardDestination(): { to: "/platform/dashboard" } {
  return { to: "/platform/dashboard" };
}

export function getPostAuthDestination(
  tenant: Tenant,
  role: string,
):
  | { to: "/$tenantSlug/dashboard"; params: { tenantSlug: string } }
  | { to: "/$tenantSlug/pos"; params: { tenantSlug: string } } {
  if (role === "cashier") {
    return { to: "/$tenantSlug/pos", params: { tenantSlug: tenant.slug } };
  }
  return { to: "/$tenantSlug/dashboard", params: { tenantSlug: tenant.slug } };
}

export function resolvePostAuthDestinationForUser(user: {
  isPlatformAdmin?: boolean;
  profile: { role: string };
}):
  | { to: "/platform/dashboard" }
  | ReturnType<typeof getPostAuthDestination>
  | { to: "/login" } {
  if (user.isPlatformAdmin) {
    return getPlatformDashboardDestination();
  }
  const { currentTenant } = useAuthStore.getState();
  if (!currentTenant) return { to: "/login" };
  return getPostAuthDestination(currentTenant, user.profile.role);
}

/** Pastikan tenant ter-load, lalu tentukan halaman setelah login/register. */
export async function resolvePostAuthDestination(role: string): Promise<
  | { to: "/login" }
  | { to: "/platform/dashboard" }
  | { to: "/$tenantSlug/dashboard"; params: { tenantSlug: string } }
  | { to: "/$tenantSlug/pos"; params: { tenantSlug: string } }
> {
  const { currentUser, currentTenant } = useAuthStore.getState();
  if (!currentUser) return { to: "/login" };

  if (currentUser.isPlatformAdmin) {
    return getPlatformDashboardDestination();
  }

  let tenant = currentTenant;
  if (!tenant && isNeonBackend()) {
    const result = await getTenant(currentUser.tenantId);
    if (result.data) {
      tenant = result.data;
      useAuthStore.setState({ currentTenant: tenant });
    } else if (result.error) {
      useAuthStore.setState({ error: result.error });
    }
  }

  if (!tenant) {
    return { to: "/login" };
  }

  return getPostAuthDestination(tenant, role);
}

export { isGoogleAuthEnabled } from "@/lib/google-auth-client";

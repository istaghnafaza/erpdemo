// =============================================================================
// Post-auth navigation helper
// =============================================================================

import { getTenant } from "@/lib/api/tenants";
import { isNeonBackend } from "@/lib/api/backend";
import { useAuthStore } from "@/stores/auth.store";
import type { Tenant } from "@/types/database";

export function getPostAuthDestination(
  tenant: Tenant,
  role: string,
):
  | { to: "/onboarding" }
  | { to: "/$tenantSlug/dashboard"; params: { tenantSlug: string } }
  | { to: "/$tenantSlug/pos"; params: { tenantSlug: string } } {
  if (!tenant.onboarding_complete) return { to: "/onboarding" };
  if (role === "cashier") {
    return { to: "/$tenantSlug/pos", params: { tenantSlug: tenant.slug } };
  }
  return { to: "/$tenantSlug/dashboard", params: { tenantSlug: tenant.slug } };
}

/** Pastikan tenant ter-load, lalu tentukan halaman setelah login/register. */
export async function resolvePostAuthDestination(role: string): Promise<
  | { to: "/login" }
  | { to: "/onboarding" }
  | { to: "/$tenantSlug/dashboard"; params: { tenantSlug: string } }
  | { to: "/$tenantSlug/pos"; params: { tenantSlug: string } }
> {
  const { currentUser, currentTenant } = useAuthStore.getState();
  if (!currentUser) return { to: "/login" };

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

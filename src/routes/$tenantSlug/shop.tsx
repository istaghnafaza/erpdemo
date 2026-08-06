// =============================================================================
// Shop layout — customer portal (tanpa auth staff).
// =============================================================================

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { FEATURE_ONLINE_ORDERS_ENABLED } from "@/lib/feature-flags";
import { getSeedPortalConfig } from "@/lib/mock-customer-portal";
import { resolvePortalTenantBySlug } from "@/lib/portal-utils";

export const Route = createFileRoute("/$tenantSlug/shop")({
  beforeLoad: ({ params }) => {
    if (!FEATURE_ONLINE_ORDERS_ENABLED) {
      throw redirect({ to: "/login" });
    }

    const tenant = resolvePortalTenantBySlug(params.tenantSlug);
    if (!tenant) throw redirect({ to: "/login" });

    const config = getSeedPortalConfig();
    if (config.tenantId !== tenant.id || !config.isActive) throw redirect({ to: "/login" });

    return { portalTenant: tenant };
  },
  component: () => <Outlet />,
});

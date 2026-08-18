// =============================================================================
// Platform admin — Neon server functions
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type {
  PlatformDashboardData,
  PlatformPriceCompareRow,
  PlatformProductSupplierPayload,
  PlatformTenantAccessUpdate,
} from "@/types/platform";
import type { Tenant } from "@/types/database";

export const neonGetPlatformDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlatformDashboardData> => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    const { getPlatformOverview, listPlatformTenants } = await import(
      "@/server/services/platform-metrics"
    );
    await requirePlatformAdminSession();
    const [overview, tenants] = await Promise.all([
      getPlatformOverview(),
      listPlatformTenants(),
    ]);
    return { overview, tenants };
  },
);

export const neonSeedPlatformAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { ensurePlatformAdminFromEnv } = await import("@/server/services/platform-admin");
  const result = await ensurePlatformAdminFromEnv();
  if (!result) {
    throw new Error(
      "Set PLATFORM_ADMIN_USERNAME, PLATFORM_ADMIN_PASSWORD, dan PLATFORM_ADMIN_EMAIL di env",
    );
  }
  return result;
});

export const neonUpdatePlatformTenantAccess = createServerFn({ method: "POST" })
  .validator((data: PlatformTenantAccessUpdate) => data)
  .handler(async ({ data }): Promise<Tenant> => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    const { adminUpdateTenantAccess } = await import(
      "@/server/services/platform-tenant-admin"
    );
    await requirePlatformAdminSession();
    return adminUpdateTenantAccess(data);
  });

export const neonSearchPlatformProductPrices = createServerFn({ method: "POST" })
  .validator((data: { query: string }) => data)
  .handler(async ({ data }): Promise<PlatformPriceCompareRow[]> => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    const { searchPlatformProductPrices } = await import(
      "@/server/services/platform-tenant-admin"
    );
    await requirePlatformAdminSession();
    return searchPlatformProductPrices(data.query);
  });

export const neonGetPlatformProductSuppliers = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; productId: string }) => data)
  .handler(async ({ data }): Promise<PlatformProductSupplierPayload> => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    const { getPlatformProductSuppliers } = await import(
      "@/server/services/platform-tenant-admin"
    );
    await requirePlatformAdminSession();
    return getPlatformProductSuppliers(data.tenantId, data.productId);
  });

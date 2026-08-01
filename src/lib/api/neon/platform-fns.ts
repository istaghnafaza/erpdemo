// =============================================================================
// Platform admin — Neon server functions
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type { PlatformDashboardData } from "@/types/platform";

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

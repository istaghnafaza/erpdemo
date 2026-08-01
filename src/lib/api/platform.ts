import { neonCall } from "@/lib/api/backend";
import { neonGetPlatformDashboard } from "@/lib/api/neon/platform-fns";
import type { ApiResponse } from "@/types/app";
import type { PlatformDashboardData } from "@/types/platform";

export async function getPlatformDashboard(): Promise<ApiResponse<PlatformDashboardData>> {
  const result = await neonCall(() => neonGetPlatformDashboard());
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: "Gagal memuat dashboard platform" };
  return { data: result.data, error: null };
}

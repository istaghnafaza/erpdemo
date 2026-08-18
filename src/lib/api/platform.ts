import { neonCall } from "@/lib/api/backend";
import {
  neonGetPlatformDashboard,
  neonGetPlatformProductSuppliers,
  neonSearchPlatformProductPrices,
  neonUpdatePlatformTenantAccess,
} from "@/lib/api/neon/platform-fns";
import type { ApiResponse } from "@/types/app";
import type {
  PlatformDashboardData,
  PlatformPriceCompareRow,
  PlatformProductSupplierPayload,
  PlatformTenantAccessUpdate,
} from "@/types/platform";
import type { Tenant } from "@/types/database";

export async function getPlatformDashboard(): Promise<ApiResponse<PlatformDashboardData>> {
  const result = await neonCall(() => neonGetPlatformDashboard());
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: "Gagal memuat dashboard platform" };
  return { data: result.data, error: null };
}

export async function updatePlatformTenantAccess(
  payload: PlatformTenantAccessUpdate,
): Promise<ApiResponse<Tenant>> {
  const result = await neonCall(() => neonUpdatePlatformTenantAccess({ data: payload }));
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: "Gagal menyimpan plan toko" };
  return { data: result.data, error: null };
}

export async function searchPlatformProductPrices(
  query: string,
): Promise<ApiResponse<PlatformPriceCompareRow[]>> {
  const result = await neonCall(() => neonSearchPlatformProductPrices({ data: { query } }));
  if (result.error) return { data: null, error: result.error };
  return { data: result.data ?? [], error: null };
}

export async function getPlatformProductSuppliers(
  tenantId: string,
  productId: string,
): Promise<ApiResponse<PlatformProductSupplierPayload>> {
  const result = await neonCall(() =>
    neonGetPlatformProductSuppliers({ data: { tenantId, productId } }),
  );
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: "Supplier tidak ditemukan" };
  return { data: result.data, error: null };
}

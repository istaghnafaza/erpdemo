// =============================================================================
// Cache invalidation helpers — call from service write paths (Sprint 2)
// =============================================================================

import {
  branchProductsKey,
  branchesPrefix,
  branchesWithManagerKey,
  categoriesKey,
  customersKey,
  suppliersKey,
  tenantBranchProductsMultiPrefix,
  tenantBranchProductsPrefix,
} from "@/server/cache/keys";
import {
  cacheDel,
  cacheDelPrefix,
  clearTrackedMultiBranchKeys,
} from "@/server/cache/redis";

export { registerMultiBranchCacheKey } from "@/server/cache/redis";

export async function invalidateBranchProducts(
  tenantId: string,
  branchId?: string,
): Promise<void> {
  if (branchId) {
    await cacheDel(branchProductsKey(tenantId, branchId));
  } else {
    await cacheDelPrefix(tenantBranchProductsPrefix(tenantId));
  }

  await clearTrackedMultiBranchKeys(tenantId);
  await cacheDelPrefix(tenantBranchProductsMultiPrefix(tenantId));
}

export async function invalidateCategories(tenantId: string): Promise<void> {
  await cacheDel(categoriesKey(tenantId));
}

export async function invalidateCustomers(tenantId: string): Promise<void> {
  await cacheDel(customersKey(tenantId));
}

export async function invalidateBranches(tenantId: string): Promise<void> {
  await cacheDelPrefix(branchesPrefix(tenantId));
  await cacheDel(branchesWithManagerKey(tenantId));
}

export async function invalidateSuppliers(tenantId: string): Promise<void> {
  await cacheDel(suppliersKey(tenantId, true));
  await cacheDel(suppliersKey(tenantId, false));
}

export async function invalidateTenantCatalog(
  tenantId: string,
  branchId?: string,
): Promise<void> {
  await Promise.all([
    invalidateBranchProducts(tenantId, branchId),
    invalidateCategories(tenantId),
    invalidateCustomers(tenantId),
  ]);
}

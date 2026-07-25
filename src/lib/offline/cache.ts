// =============================================================================
// Offline cache refresh — products & customers (Fase 15).
// =============================================================================

import { getBranchProducts } from "@/lib/api/products";
import { getCustomers } from "@/lib/api/customers";
import { getMockPosCatalog } from "@/lib/mock-pos-catalog";
import { getMockTenantCustomers } from "@/stores/customers.store";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import { isNeonBackend } from "@/lib/api/backend";
import { isMockTenantId } from "@/lib/mock-session";
import {
  saveProducts,
  saveCustomers,
  saveCacheMeta,
  type CacheMeta,
} from "@/lib/offline/idb";

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

export async function refreshCache(tenantId: string, branchId: string): Promise<CacheMeta> {
  const isMock = isMockTenantId(tenantId);

  let products;
  let customers;

  if (isMock) {
    products = getMockPosCatalog(branchId);
    customers = getMockTenantCustomers(tenantId);
  } else {
    const [prodRes, custRes] = await Promise.all([
      getBranchProducts(tenantId, branchId),
      getCustomers(tenantId),
    ]);
    products = prodRes.data ?? [];
    customers = custRes.data ?? [];
  }

  await saveProducts(tenantId, branchId, products);
  await saveCustomers(tenantId, branchId, customers);

  const meta: CacheMeta = {
    refreshedAt: new Date().toISOString(),
    productCount: products.length,
    customerCount: customers.length,
  };
  await saveCacheMeta(tenantId, branchId, meta);
  return meta;
}

export function startCacheRefreshInterval(
  tenantId: string,
  branchId: string,
): void {
  if (typeof window === "undefined") return;
  stopCacheRefreshInterval();

  refreshTimer = setInterval(() => {
    void refreshCache(tenantId, branchId).catch(() => undefined);
  }, REFRESH_INTERVAL_MS);
}

export function stopCacheRefreshInterval(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

export async function refreshCacheOnReconnect(
  tenantId: string,
  branchId: string,
): Promise<void> {
  if (!tenantId || !branchId) return;
  await refreshCache(tenantId, branchId);
}

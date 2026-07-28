// =============================================================================
// POS catalog IndexedDB warm — instant display, background refresh (Sprint 4 P1-4)
// =============================================================================

import { getBranchProducts } from "@/lib/api/products";
import {
  getProducts as getIdbProducts,
  saveProducts,
  saveCacheMeta,
} from "@/lib/offline/idb";
import type { BranchProductWithProduct } from "@/types/database";

export async function readPosCatalogFromIdb(
  tenantId: string,
  branchId: string,
): Promise<BranchProductWithProduct[]> {
  return getIdbProducts<BranchProductWithProduct>(tenantId, branchId);
}

export async function writePosCatalogToIdb(
  tenantId: string,
  branchId: string,
  products: BranchProductWithProduct[],
  customerCount = 0,
): Promise<void> {
  await saveProducts(tenantId, branchId, products);
  await saveCacheMeta(tenantId, branchId, {
    refreshedAt: new Date().toISOString(),
    productCount: products.length,
    customerCount,
  });
}

/**
 * Stale-while-revalidate: return IDB cache immediately when available,
 * fetch fresh data from server and persist to IDB.
 */
export async function fetchPosCatalogWithWarm(
  tenantId: string,
  branchId: string,
  onFresh?: (products: BranchProductWithProduct[]) => void,
): Promise<BranchProductWithProduct[]> {
  const cached = await readPosCatalogFromIdb(tenantId, branchId);

  const result = await getBranchProducts(tenantId, branchId);
  if (result.error) {
    if (cached.length > 0) return cached;
    throw new Error(result.error);
  }

  const fresh = result.data ?? [];
  void writePosCatalogToIdb(tenantId, branchId, fresh);
  onFresh?.(fresh);

  return cached.length > 0 ? cached : fresh;
}

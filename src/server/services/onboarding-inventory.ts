// =============================================================================
// Onboarding inventory → Neon (Phase 2)
// =============================================================================

import type { OnboardingInventoryItem } from "@/lib/apply-onboarding-inventory";
import {
  createProduct,
  ensureBranchProductRow,
  ensureCategory,
  getProductBySku,
  updateProduct,
} from "@/server/services/products";

function nextSku(base: string, index: number): string {
  return `${base}-${String(index).padStart(3, "0")}`;
}

export async function applyOnboardingItemsToBranch(
  tenantId: string,
  branchId: string,
  items: OnboardingInventoryItem[],
): Promise<{ applied: number }> {
  let applied = 0;
  let skuFallback = 1;

  for (const item of items) {
    if (!item.name.trim() || item.sellPrice <= 0) continue;

    let sku = item.sku.trim();
    if (!sku) sku = nextSku("BRG", skuFallback++);

    let product = await getProductBySku(tenantId, sku);
    if (!product) {
      const cat = await ensureCategory(tenantId, item.categoryName || "Lainnya");
      product = await createProduct(tenantId, {
        sku,
        barcode: null,
        name: item.name.trim(),
        category_id: cat.id,
        unit: item.unit || "pcs",
        purchase_price: item.purchasePrice,
        is_active: true,
      });
    } else {
      await updateProduct(tenantId, product.id, {
        name: item.name.trim(),
        purchase_price: item.purchasePrice,
        unit: item.unit || product.unit,
      });
    }

    const verifiedStock = item.markLegacy ? 0 : item.initialStock;
    const legacyStock = item.markLegacy ? Math.max(item.initialStock, 1) : 0;

    await ensureBranchProductRow(tenantId, branchId, product.id, {
      sellingPrice: item.sellPrice,
      stock: verifiedStock,
      legacyStock,
      reorderPoint: 5,
    });

    applied += 1;
  }

  return { applied };
}

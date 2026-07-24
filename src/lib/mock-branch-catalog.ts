// =============================================================================
// Mock branch catalog — gabung seed POS, override inventori, & legacy mode.
// =============================================================================

import { MOCK_BRANCH_ONBOARDING } from "@/lib/mock-ids";
import { getMockPosCatalog, MOCK_SKU_CATEGORY } from "@/lib/mock-pos-catalog";
import type { MockProductOverride } from "@/stores/inventory.store";
import type { DbStockSource } from "@/types/database";

export interface MockCatalogLine {
  branchProductId: string;
  productId: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  legacyStock: number;
  reorderPoint: number;
  stockSource: DbStockSource;
  canAddToCart: boolean;
}

function adjKey(branchId: string, productId: string): string {
  return `${branchId}:${productId}`;
}

function computeStock(
  branchId: string,
  productId: string,
  baseStock: number,
  stockDelta: Record<string, number>,
  stockAdjustments: Record<string, number>,
): number {
  const posDelta = stockDelta[productId] ?? 0;
  const invDelta = stockAdjustments[adjKey(branchId, productId)] ?? 0;
  return Math.max(0, baseStock + posDelta + invDelta);
}

export function buildMockBranchCatalog(input: {
  branchId: string;
  legacyModeActive: boolean;
  stockDelta: Record<string, number>;
  stockAdjustments: Record<string, number>;
  overrides: Record<string, MockProductOverride>;
  deactivated: Record<string, boolean>;
}): MockCatalogLine[] {
  const {
    branchId,
    legacyModeActive,
    stockDelta,
    stockAdjustments,
    overrides,
    deactivated,
  } = input;

  const baseCatalog =
    branchId === MOCK_BRANCH_ONBOARDING ? [] : getMockPosCatalog(branchId);
  const lines: MockCatalogLine[] = [];
  const seen = new Set<string>();

  for (const bp of baseCatalog) {
    if (deactivated[bp.product_id] || overrides[bp.product_id]?.isActive === false) continue;

    const override = overrides[bp.product_id];
    const stock = computeStock(branchId, bp.product_id, bp.stock, stockDelta, stockAdjustments);
    const legacyStock = override?.legacyStock ?? bp.legacy_stock ?? 0;
    const stockSource: DbStockSource =
      stock > 0 ? "verified" : legacyStock > 0 ? "legacy" : legacyModeActive ? "unverified" : "verified";

    lines.push({
      branchProductId: bp.id,
      productId: bp.product_id,
      sku: override?.sku ?? bp.product.sku,
      name: override?.name ?? bp.product.name,
      unit: override?.unit ?? bp.product.unit,
      category: override?.categoryName ?? MOCK_SKU_CATEGORY[bp.product.sku] ?? "Lainnya",
      sellingPrice: override?.sellingPrice ?? bp.selling_price,
      purchasePrice: override?.purchasePrice ?? bp.product.purchase_price,
      stock,
      legacyStock,
      reorderPoint: override?.reorderPoint ?? bp.reorder_point,
      stockSource,
      canAddToCart: stock > 0 || legacyModeActive,
    });
    seen.add(bp.product_id);
  }

  for (const [pid, override] of Object.entries(overrides)) {
    if (deactivated[pid] || override.isActive === false) continue;
    if (seen.has(pid)) continue;
    if (!override.sku || !override.name) continue;

    const stock = computeStock(branchId, pid, override.initialStock ?? 0, stockDelta, stockAdjustments);
    const legacyStock = override.legacyStock ?? 0;
    const stockSource: DbStockSource =
      stock > 0 ? "verified" : legacyStock > 0 ? "legacy" : legacyModeActive ? "unverified" : "verified";

    lines.push({
      branchProductId: `new-${branchId}-${pid}`,
      productId: pid,
      sku: override.sku,
      name: override.name,
      unit: override.unit ?? "pcs",
      category: override.categoryName ?? "Lainnya",
      sellingPrice: override.sellingPrice ?? 0,
      purchasePrice: override.purchasePrice ?? 0,
      stock,
      legacyStock,
      reorderPoint: override.reorderPoint ?? 5,
      stockSource,
      canAddToCart: (override.sellingPrice ?? 0) > 0 && (stock > 0 || legacyModeActive),
    });
  }

  return lines.filter((l) => l.sellingPrice > 0);
}

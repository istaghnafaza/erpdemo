// =============================================================================
// Apply onboarding wizard products → inventory store (go-live tanpa tutup toko).
// =============================================================================

import { PRODUCTS } from "@/lib/mock-data";
import { productId, generateNextProductSku } from "@/lib/mock-pos-catalog";
import { isNeonBackend, neonCall } from "@/lib/api/backend";
import { neonApplyOnboardingInventory } from "@/lib/api/neon/catalog-fns";
import { useInventoryStore, type MockProductOverride } from "@/stores/inventory.store";
import type {
  BookProductRow,
  ExcelImportRow,
  OnboardingPath,
  OnboardingProductDraft,
} from "@/stores/onboarding.store";

export interface OnboardingInventoryItem {
  sku: string;
  name: string;
  unit: string;
  categoryName: string;
  sellPrice: number;
  purchasePrice: number;
  initialStock: number;
  /** Stok belum diverifikasi — boleh dijual saat legacy mode aktif. */
  markLegacy: boolean;
  barcode?: string | null;
  reorderPoint?: number;
  warehouseLocation?: string;
}

export function collectOnboardingInventoryItems(input: {
  path: OnboardingPath;
  products: OnboardingProductDraft[];
  bookRows: BookProductRow[];
  excelRows: ExcelImportRow[];
  legacyMode: boolean;
}): OnboardingInventoryItem[] {
  const { path, products, bookRows, excelRows, legacyMode } = input;

  if (path === "new") {
    return products
      .filter((p) => p.selected)
      .map((p) => {
        const seed = PRODUCTS.find((x) => x.sku === p.sku);
        const stock = p.initialStock;
        return {
          sku: p.sku,
          name: p.name,
          unit: seed?.unit ?? "pcs",
          categoryName: seed?.category ?? "Lainnya",
          sellPrice: p.sellPrice || seed?.sellPrice || 0,
          purchasePrice: seed?.costPrice ?? Math.round((p.sellPrice || seed?.sellPrice || 0) * 0.7),
          initialStock: stock,
          markLegacy: legacyMode && stock <= 0,
        };
      });
  }

  if (path === "excel") {
    return excelRows
      .filter((r) => r.valid && r.name.trim())
      .map((r) => ({
        sku: r.sku.trim() || generateNextProductSku(excelRows.map((x) => x.sku)),
        name: r.name.trim(),
        unit: "pcs",
        categoryName: "Lainnya",
        sellPrice: r.sellPrice,
        purchasePrice: Math.round(r.sellPrice * 0.7),
        initialStock: r.stock,
        markLegacy: legacyMode && r.stock <= 0,
      }));
  }

  // book + no-records
  const usedSkus = new Set(PRODUCTS.map((p) => p.sku));
  return bookRows
    .filter((r) => r.name.trim())
    .map((r) => {
      const sku = generateNextProductSku(usedSkus);
      usedSkus.add(sku);
      return {
        sku,
        name: r.name.trim(),
        unit: r.unit || "pcs",
        categoryName: r.category || "Lainnya",
        sellPrice: r.sellPrice,
        purchasePrice: Math.round((r.sellPrice || 0) * 0.7),
        initialStock: r.stock,
        markLegacy: legacyMode && r.stock <= 0,
      };
    });
}

/** Tulis produk onboarding ke inventori mock untuk cabang tertentu. */
export function applyOnboardingInventoryToBranchMock(
  branchId: string,
  items: OnboardingInventoryItem[],
): { applied: number } {
  if (items.length === 0) return { applied: 0 };

  const store = useInventoryStore.getState();
  const existingOverrides = store.mockProductOverrides;
  let nextIndex = PRODUCTS.length + Object.keys(existingOverrides).length + 1;
  let applied = 0;

  for (const item of items) {
    if (!item.name.trim() || item.sellPrice <= 0) continue;

    const seedIdx = PRODUCTS.findIndex((p) => p.sku === item.sku);
    const pid = seedIdx >= 0 ? productId(seedIdx) : productId(nextIndex++);

    const data: MockProductOverride = {
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      categoryName: item.categoryName,
      sellingPrice: item.sellPrice,
      purchasePrice: item.purchasePrice,
      reorderPoint: item.reorderPoint ?? 5,
      warehouseLocation: item.warehouseLocation ?? "",
      barcode: item.barcode ?? null,
      initialStock: item.initialStock,
      legacyStock: item.markLegacy ? 1 : 0,
      isActive: true,
    };

    store.addMockProduct(pid, data);
    applied += 1;
  }

  return { applied };
}

/** Persist onboarding inventory — mock (Zustand) or Neon (server). */
export async function applyOnboardingInventoryToBranch(
  tenantId: string,
  branchId: string,
  items: OnboardingInventoryItem[],
): Promise<{ applied: number }> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonApplyOnboardingInventory({ data: { tenantId, branchId, items } }),
    );
    if (result.error) throw new Error(result.error);
    return result.data ?? { applied: 0 };
  }
  return applyOnboardingInventoryToBranchMock(branchId, items);
}

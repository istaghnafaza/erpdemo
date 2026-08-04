// =============================================================================
// Mock product ↔ supplier links — demo tenant
// =============================================================================

import { PRODUCTS } from "@/lib/mock-data";
import { productId } from "@/lib/mock-pos-catalog";
import {
  MOCK_SUPPLIER_BESI,
  MOCK_SUPPLIER_SEMEN,
} from "@/lib/mock-sales-orders";
import {
  MOCK_SUPPLIER_CAT,
  MOCK_SUPPLIER_STEEL,
} from "@/lib/mock-purchasing";

export interface MockProductSupplierLink {
  product_id: string;
  supplier_id: string;
  is_preferred: boolean;
}

/** Pemetaan kategori → supplier utama untuk seed demo. */
const CATEGORY_SUPPLIER: Record<string, string> = {
  "Semen & Beton": MOCK_SUPPLIER_SEMEN,
  "Bata & Blok": MOCK_SUPPLIER_SEMEN,
  "Cat & Finishing": MOCK_SUPPLIER_CAT,
  "Besi & Logam": MOCK_SUPPLIER_BESI,
  "Pipa & Sanitasi": MOCK_SUPPLIER_BESI,
  "Keramik & Lantai": MOCK_SUPPLIER_SEMEN,
  "Kayu & Triplek": MOCK_SUPPLIER_BESI,
  "Atap & Rangka": MOCK_SUPPLIER_SEMEN,
  Listrik: MOCK_SUPPLIER_STEEL,
};

function seedLinks(): MockProductSupplierLink[] {
  const links: MockProductSupplierLink[] = [];
  const seen = new Set<string>();

  PRODUCTS.forEach((p, i) => {
    const pid = productId(i);
    const primary = CATEGORY_SUPPLIER[p.category] ?? MOCK_SUPPLIER_SEMEN;
    const key = `${pid}:${primary}`;
    if (!seen.has(key)) {
      links.push({ product_id: pid, supplier_id: primary, is_preferred: true });
      seen.add(key);
    }

    if (p.category === "Besi & Logam" && primary === MOCK_SUPPLIER_BESI) {
      const altKey = `${pid}:${MOCK_SUPPLIER_STEEL}`;
      if (!seen.has(altKey)) {
        links.push({ product_id: pid, supplier_id: MOCK_SUPPLIER_STEEL, is_preferred: false });
        seen.add(altKey);
      }
    }
  });

  return links;
}

export const MOCK_PRODUCT_SUPPLIER_LINKS: MockProductSupplierLink[] = seedLinks();

export function mockGetSupplierIdsForProduct(productIdVal: string): string[] {
  const ids = MOCK_PRODUCT_SUPPLIER_LINKS.filter((l) => l.product_id === productIdVal).map(
    (l) => l.supplier_id,
  );
  return [...new Set(ids)];
}

export function mockGetPreferredSupplierIdForProduct(productIdVal: string): string | null {
  const preferred = MOCK_PRODUCT_SUPPLIER_LINKS.find(
    (l) => l.product_id === productIdVal && l.is_preferred,
  );
  if (preferred) return preferred.supplier_id;
  const any = MOCK_PRODUCT_SUPPLIER_LINKS.find((l) => l.product_id === productIdVal);
  return any?.supplier_id ?? null;
}

export function mockGetProductIdsForSupplier(supplierId: string): string[] {
  return MOCK_PRODUCT_SUPPLIER_LINKS.filter((l) => l.supplier_id === supplierId).map(
    (l) => l.product_id,
  );
}

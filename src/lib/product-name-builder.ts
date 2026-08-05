// =============================================================================
// Smart Product Name / SKU builder dari jenis barang + attribute terpilih.
// =============================================================================

import {
  isBulkMaterialCategory,
  resolveCategoryForAttributes,
} from "@/lib/category-attribute-map";
import type {
  NameInclusionFlags,
  ProductAttributeSelections,
  ProductType,
  ResolvedProductTypeAttribute,
} from "@/types/product-attributes";
import { PRODUCT_TYPE_NAME_KEY } from "@/types/product-attributes";

export { resolveCategoryForAttributes, isBulkMaterialCategory } from "@/lib/category-attribute-map";

export function listActiveAttributesForProductType(
  attributes: ResolvedProductTypeAttribute[],
): ResolvedProductTypeAttribute[] {
  return attributes.filter((a) => a.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function buildProductNameFromTypeAttributes(
  productType: ProductType | undefined,
  attributes: ResolvedProductTypeAttribute[],
  selections: ProductAttributeSelections,
  nameInclusions?: NameInclusionFlags,
): string {
  const parts: string[] = [];
  if (productType?.name && nameInclusions?.[PRODUCT_TYPE_NAME_KEY] !== false) {
    parts.push(productType.name);
  }
  for (const attr of listActiveAttributesForProductType(attributes)) {
    const valueId = selections[attr.assignmentId];
    if (!valueId) continue;
    if (nameInclusions && nameInclusions[attr.assignmentId] === false) continue;
    const val = attr.values.find((v) => v.id === valueId && v.isActive);
    if (val) parts.push(val.label);
  }
  return parts.join(" ");
}

/** Nama material curah: "Pasir Lumajang / Truk" */
export function buildBulkMaterialName(
  productType: ProductType | undefined,
  attributes: ResolvedProductTypeAttribute[],
  categoryName: string,
  selections: ProductAttributeSelections,
  nameInclusions?: NameInclusionFlags,
): string {
  if (!isBulkMaterialCategory(categoryName)) {
    return buildProductNameFromTypeAttributes(
      productType,
      attributes,
      selections,
      nameInclusions,
    );
  }
  const attrs = listActiveAttributesForProductType(attributes);
  const satuan = attrs.find((a) => a.name === "Satuan Jual");
  const satuanVal =
    satuan && selections[satuan.assignmentId]
      ? satuan.values.find((v) => v.id === selections[satuan!.assignmentId] && v.isActive)
      : undefined;
  const includeType = nameInclusions?.[PRODUCT_TYPE_NAME_KEY] !== false;
  if (productType?.name && satuanVal && includeType) {
    const unitLabel = satuanVal.label.replace(/^per\s+/i, "");
    return `${productType.name} / ${unitLabel}`;
  }
  if (productType?.name && satuanVal && !includeType) {
    return satuanVal.label.replace(/^per\s+/i, "");
  }
  return buildProductNameFromTypeAttributes(
    productType,
    attributes,
    selections,
    nameInclusions,
  );
}

export function buildProductSkuFromTypeAttributes(
  productType: ProductType | undefined,
  attributes: ResolvedProductTypeAttribute[],
  selections: ProductAttributeSelections,
): string {
  const parts: string[] = [];
  if (productType?.abbreviation) parts.push(productType.abbreviation.toUpperCase());
  for (const attr of listActiveAttributesForProductType(attributes)) {
    const valueId = selections[attr.assignmentId];
    if (!valueId) continue;
    const val = attr.values.find((v) => v.id === valueId && v.isActive);
    if (val?.abbreviation) parts.push(val.abbreviation.toUpperCase());
  }
  return parts.join("-");
}

export function ensureUniqueSku(baseSku: string, existingSkus: Iterable<string>): string {
  const taken = new Set(Array.from(existingSkus).map((s) => s.trim().toUpperCase()));
  const normalized = baseSku.trim().toUpperCase();
  if (!normalized) return "";
  if (!taken.has(normalized)) return normalized;
  let n = 2;
  while (taken.has(`${normalized}-${n}`)) n += 1;
  return `${normalized}-${n}`;
}

export function suggestAbbreviation(label: string): string {
  const cleaned = label.trim();
  if (!cleaned) return "X";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const w = words[0].replace(/[^a-zA-Z0-9]/g, "");
    return (w.slice(0, 4) || "X").toUpperCase();
  }
  return words
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").charAt(0))
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

/** @deprecated Legacy — kept for any stale imports */
export function listActiveAttributesForCategory(): never[] {
  return [];
}

/** @deprecated Legacy */
export function buildProductNameFromAttributes(): string {
  return "";
}

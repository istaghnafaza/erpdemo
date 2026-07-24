// =============================================================================
// Smart Product Name / SKU builder dari attribute terpilih.
// =============================================================================

import type {
  ProductAttributeDefinition,
  ProductAttributeSelections,
} from "@/types/product-attributes";

export function listActiveAttributesForCategory(
  attributes: ProductAttributeDefinition[],
  categoryName: string,
): ProductAttributeDefinition[] {
  return attributes
    .filter((a) => a.categoryName === categoryName && a.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function buildProductNameFromAttributes(
  attributes: ProductAttributeDefinition[],
  categoryName: string,
  selections: ProductAttributeSelections,
): string {
  const parts: string[] = [];
  for (const attr of listActiveAttributesForCategory(attributes, categoryName)) {
    const valueId = selections[attr.id];
    if (!valueId) continue;
    const val = attr.values.find((v) => v.id === valueId && v.isActive);
    if (val) parts.push(val.label);
  }
  return parts.join(" ");
}

/** Nama material curah: "Pasir Lumajang / Truk" */
export function buildBulkMaterialName(
  attributes: ProductAttributeDefinition[],
  categoryName: string,
  selections: ProductAttributeSelections,
): string {
  if (categoryName !== "Pasir & Material Curah") {
    return buildProductNameFromAttributes(attributes, categoryName, selections);
  }
  const attrs = listActiveAttributesForCategory(attributes, categoryName);
  const jenis = attrs.find((a) => a.name === "Jenis");
  const satuan = attrs.find((a) => a.name === "Satuan Jual");
  const jenisVal =
    jenis && selections[jenis.id]
      ? jenis.values.find((v) => v.id === selections[jenis!.id] && v.isActive)
      : undefined;
  const satuanVal =
    satuan && selections[satuan.id]
      ? satuan.values.find((v) => v.id === selections[satuan!.id] && v.isActive)
      : undefined;
  if (jenisVal && satuanVal) {
    const unitLabel = satuanVal.label.replace(/^per\s+/i, "");
    return `${jenisVal.label} / ${unitLabel}`;
  }
  return buildProductNameFromAttributes(attributes, categoryName, selections);
}

export function buildProductSkuFromAttributes(
  attributes: ProductAttributeDefinition[],
  categoryName: string,
  selections: ProductAttributeSelections,
): string {
  const parts: string[] = [];
  for (const attr of listActiveAttributesForCategory(attributes, categoryName)) {
    const valueId = selections[attr.id];
    if (!valueId) continue;
    const val = attr.values.find((v) => v.id === valueId && v.isActive);
    if (val?.abbreviation) parts.push(val.abbreviation.toUpperCase());
  }
  return parts.join("-");
}

export function ensureUniqueSku(baseSku: string, existingSkus: Iterable<string>): string {
  const taken = new Set(
    Array.from(existingSkus).map((s) => s.trim().toUpperCase()),
  );
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

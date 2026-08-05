// =============================================================================
// Pemetaan nama kategori inventori → kategori attribute (canonical).
// =============================================================================

/** Nama kategori canonical — harus match SEED_PRODUCT_ATTRIBUTE_CATEGORIES. */
export const CANONICAL_ATTRIBUTE_CATEGORIES = [
  "Semen & Beton",
  "Bata & Blok",
  "Cat & Finishing",
  "Pipa & Sanitasi",
  "Keramik & Lantai",
  "Besi & Logam",
  "Kayu & Triplek",
  "Atap & Rangka",
  "Listrik",
  "Pasir & Material Curah",
  "Aluminium",
  "PVC",
  "Interior & Aksesoris",
] as const;

export type CanonicalAttributeCategory = (typeof CANONICAL_ATTRIBUTE_CATEGORIES)[number];

/** Alias dari DB / mock / tenant lama → kategori attribute. */
export const CATEGORY_ATTRIBUTE_ALIASES: Record<string, CanonicalAttributeCategory> = {
  "Semen & Bahan Bangunan": "Semen & Beton",
  Semen: "Semen & Beton",
  "Semen & Mortar": "Semen & Beton",
  "Cat & Pelapis": "Cat & Finishing",
  "Cat & Waterproof": "Cat & Finishing",
  "Bata & Batu": "Bata & Blok",
  "Bata & Batako": "Bata & Blok",
  "Besi & Rangka": "Besi & Logam",
  "Keramik & Granit": "Keramik & Lantai",
  "Pipa & Fitting": "Pipa & Sanitasi",
  "Besi & Atap": "Atap & Rangka",
  "Plafon PVC": "PVC",
  "Material PVC": "PVC",
  "Interior": "Interior & Aksesoris",
  "Hardware": "Interior & Aksesoris",
  "Aksesoris Interior": "Interior & Aksesoris",
};

export function resolveCategoryForAttributes(categoryName: string): string {
  const trimmed = categoryName.trim();
  if (!trimmed) return trimmed;
  return CATEGORY_ATTRIBUTE_ALIASES[trimmed] ?? trimmed;
}

export function isBulkMaterialCategory(categoryName: string): boolean {
  return resolveCategoryForAttributes(categoryName) === "Pasir & Material Curah";
}

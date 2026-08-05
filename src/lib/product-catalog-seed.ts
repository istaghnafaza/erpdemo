// =============================================================================
// Seed & migrasi — katalog platform v4 (kategori + global attr + jenis barang)
// =============================================================================

import { CANONICAL_ATTRIBUTE_CATEGORIES } from "@/lib/category-attribute-map";
import { getSeedProductAttributes } from "@/lib/mock-product-attributes";
import { suggestAbbreviation } from "@/lib/product-name-builder";
import type {
  CatalogCategory,
  GlobalAttribute,
  PlatformCatalogPayload,
  ProductAttributeDefinition,
  ProductType,
  ProductTypeAttribute,
} from "@/types/product-attributes";

export const CATALOG_SEED_VERSION = 4;

export const SEED_PRODUCT_ATTRIBUTE_CATEGORIES = CANONICAL_ATTRIBUTE_CATEGORIES;

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Aluminium: "Toko spesialis aluminium — profil, plat, hollow, aksesoris",
  PVC: "Spesialis plafon PVC & material PVC",
  "Interior & Aksesoris": "Handle, kunci, engsel, sheet HPL, hardware interior",
};

/** Atribut global standar — bisa ditambah developer */
export const DEFAULT_GLOBAL_ATTRIBUTE_NAMES = [
  "Ukuran",
  "Merk",
  "Panjang",
  "Spesifikasi",
  "Bahan",
  "Kemasan",
  "Finish",
  "Warna",
  "Kelas",
  "Aplikasi",
  "Grade",
  "Treatment",
  "Material",
  "Kapasitas",
  "Tipe",
  "Satuan Jual",
  "Sumber",
  "Gradasi",
  "Motif",
  "Tebal",
  "Kualitas",
] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getSeedCatalogCategories(): CatalogCategory[] {
  return CANONICAL_ATTRIBUTE_CATEGORIES.map((name, index) => ({
    id: `cat-${slugify(name)}`,
    name,
    description: CATEGORY_DESCRIPTIONS[name],
    sortOrder: index + 1,
    isActive: true,
  }));
}

export interface ProductCatalogSeed {
  catalogCategories: CatalogCategory[];
  globalAttributes: GlobalAttribute[];
  productTypes: ProductType[];
  typeAttributes: ProductTypeAttribute[];
}

export function migrateFlatAttributesToCatalog(
  flat: ProductAttributeDefinition[],
): ProductCatalogSeed {
  const globalByName = new Map<string, GlobalAttribute>();
  let gaOrder = 0;

  const ensureGlobal = (name: string, preferredId?: string): GlobalAttribute => {
    const key = name.toLowerCase();
    const existing = globalByName.get(key);
    if (existing) return existing;
    gaOrder += 1;
    const ga: GlobalAttribute = {
      id: preferredId ?? `ga-${slugify(name)}`,
      name,
      sortOrder: gaOrder,
      isActive: true,
    };
    globalByName.set(key, ga);
    return ga;
  };

  for (const name of DEFAULT_GLOBAL_ATTRIBUTE_NAMES) {
    ensureGlobal(name);
  }

  const productTypes: ProductType[] = [];
  const typeAttributes: ProductTypeAttribute[] = [];

  const byCategory = new Map<string, ProductAttributeDefinition[]>();
  for (const attr of flat) {
    const list = byCategory.get(attr.categoryName) ?? [];
    list.push(attr);
    byCategory.set(attr.categoryName, list);
  }

  for (const categoryName of SEED_PRODUCT_ATTRIBUTE_CATEGORIES) {
    const attrs = (byCategory.get(categoryName) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
    const jenisAttr = attrs.find((a) => a.name === "Jenis");
    const specAttrs = attrs.filter((a) => a.name !== "Jenis");

    for (const attr of specAttrs) {
      ensureGlobal(attr.name, `ga-${attr.id.replace(/^attr-/, "")}`);
    }

    const jenisValues = jenisAttr?.values.filter((v) => v.isActive) ?? [];
    const typesToCreate =
      jenisValues.length > 0
        ? jenisValues
        : [
            {
              id: `default-${slugify(categoryName)}`,
              label: "Umum",
              abbreviation: "UMM",
              sortOrder: 1,
              isActive: true,
            },
          ];

    for (const jenisVal of typesToCreate) {
      const ptId = jenisVal.id.startsWith("default-")
        ? `pt-${jenisVal.id}`
        : `pt-${jenisVal.id}`;
      productTypes.push({
        id: ptId,
        categoryName,
        name: jenisVal.label,
        abbreviation: jenisVal.abbreviation || suggestAbbreviation(jenisVal.label),
        sortOrder: jenisVal.sortOrder,
        isActive: jenisVal.isActive,
      });

      for (const attr of specAttrs) {
        const ga = ensureGlobal(attr.name);
        typeAttributes.push({
          id: `ta-${ptId}-${ga.id}`,
          productTypeId: ptId,
          globalAttributeId: ga.id,
          sortOrder: attr.sortOrder,
          isActive: attr.isActive,
          values: attr.values.map((v) => ({ ...v })),
        });
      }
    }
  }

  return {
    catalogCategories: getSeedCatalogCategories(),
    globalAttributes: Array.from(globalByName.values()).sort((a, b) => a.sortOrder - b.sortOrder),
    productTypes,
    typeAttributes,
  };
}

export function getSeedProductCatalog(): ProductCatalogSeed {
  return migrateFlatAttributesToCatalog(getSeedProductAttributes());
}

export function getSeedPlatformCatalogPayload(): PlatformCatalogPayload {
  const seed = getSeedProductCatalog();
  return {
    version: CATALOG_SEED_VERSION,
    ...seed,
    publishedAt: new Date().toISOString(),
  };
}

/** Pastikan payload dari server/localStorage lama tetap valid. */
export function normalizePlatformCatalogPayload(
  raw: Partial<PlatformCatalogPayload> | null | undefined,
): PlatformCatalogPayload {
  const seed = getSeedPlatformCatalogPayload();
  if (!raw) return seed;
  return {
    version: Math.max(raw.version ?? 0, seed.version),
    catalogCategories:
      raw.catalogCategories?.length ? raw.catalogCategories : seed.catalogCategories,
    globalAttributes: raw.globalAttributes?.length ? raw.globalAttributes : seed.globalAttributes,
    productTypes: raw.productTypes?.length ? raw.productTypes : seed.productTypes,
    typeAttributes: raw.typeAttributes?.length ? raw.typeAttributes : seed.typeAttributes,
    publishedAt: raw.publishedAt ?? seed.publishedAt,
  };
}

/** Panduan urutan spesifikasi per kategori (tanpa Jenis — sudah jadi jenis barang) */
export const CATEGORY_ATTRIBUTE_HINTS: Record<string, string> = {
  "Semen & Beton": "Kemasan → tipe → aplikasi → merk",
  "Bata & Blok": "Ukuran → kualitas → merk",
  "Cat & Finishing": "Kemasan → finishing → warna → merk",
  "Pipa & Sanitasi": "Bahan → ukuran → kelas → aplikasi → merk",
  "Keramik & Lantai": "Ukuran → finish → motif → tebal → merk",
  "Besi & Logam": "Ukuran → panjang → spesifikasi → aplikasi → merk",
  "Kayu & Triplek": "Ukuran → grade → treatment → merk",
  "Atap & Rangka": "Ukuran → material → warna → merk",
  Listrik: "Kapasitas → spesifikasi → warna kabel → merk",
  "Pasir & Material Curah": "Satuan jual → sumber → gradasi (nama: Jenis / Satuan)",
  Aluminium: "Ukuran → tebal → finish → merk",
  PVC: "Ukuran → warna → motif → merk",
  "Interior & Aksesoris": "Ukuran → finish → material → merk",
};

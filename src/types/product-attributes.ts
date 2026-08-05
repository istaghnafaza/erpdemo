// =============================================================================
// Product Catalog — atribut global, jenis barang per kategori, nilai per jenis
// =============================================================================

export interface ProductAttributeValue {
  id: string;
  label: string;
  /** Singkatan untuk SKU (contoh: PVC, 34, RUC) */
  abbreviation: string;
  sortOrder: number;
  isActive: boolean;
}

/** Kategori produk platform — dikelola developer, dipakai semua toko */
export interface CatalogCategory {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

/** Atribut global — dipakai ulang di banyak jenis barang (Ukuran, Merk, dll.) */
export interface GlobalAttribute {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

/** Jenis barang dalam kategori (mis. Besi Hollow, Hollow Galvanis) */
export interface ProductType {
  id: string;
  categoryName: string;
  name: string;
  /** Singkatan untuk bagian awal SKU */
  abbreviation: string;
  sortOrder: number;
  isActive: boolean;
}

/** Atribut global yang di-assign ke jenis barang, beserta nilainya */
export interface ProductTypeAttribute {
  id: string;
  productTypeId: string;
  globalAttributeId: string;
  sortOrder: number;
  isActive: boolean;
  values: ProductAttributeValue[];
}

/** Untuk UI / name builder — atribut ter-resolve dengan nama global */
export interface ResolvedProductTypeAttribute {
  assignmentId: string;
  globalAttributeId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  values: ProductAttributeValue[];
}

export type ProductAttributeSelections = Record<string, string>;

/** assignmentId → sertakan di nama produk; key khusus __productType__ untuk jenis barang */
export type NameInclusionFlags = Record<string, boolean>;

export const PRODUCT_TYPE_NAME_KEY = "__productType__";

export type CatalogRequestStatus = "pending" | "approved" | "rejected";

export type CatalogRequestKind =
  | "category"
  | "product_type"
  | "global_attribute"
  | "attribute_value";

export interface CatalogRequest {
  id: string;
  tenantId: string;
  tenantName: string;
  kind: CatalogRequestKind;
  status: CatalogRequestStatus;
  categoryName?: string;
  productTypeName?: string;
  attributeName?: string;
  proposedLabel: string;
  proposedAbbreviation?: string;
  notes?: string;
  createdAt: string;
  resolvedAt?: string;
}

/** Snapshot katalog platform — sama untuk semua toko */
export interface PlatformCatalogPayload {
  version: number;
  catalogCategories: CatalogCategory[];
  globalAttributes: GlobalAttribute[];
  productTypes: ProductType[];
  typeAttributes: ProductTypeAttribute[];
  publishedAt?: string;
}

/** @deprecated Legacy flat model — dipakai hanya untuk migrasi seed v2 */
export interface ProductAttributeDefinition {
  id: string;
  categoryName: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  values: ProductAttributeValue[];
}

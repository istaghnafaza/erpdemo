// =============================================================================
// Product Attributes — definisi per kategori untuk Smart Product Name Builder
// =============================================================================

export interface ProductAttributeValue {
  id: string;
  label: string;
  /** Singkatan untuk SKU (contoh: PVC, 34, RUC) */
  abbreviation: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductAttributeDefinition {
  id: string;
  categoryName: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  values: ProductAttributeValue[];
}

export type ProductAttributeSelections = Record<string, string>;

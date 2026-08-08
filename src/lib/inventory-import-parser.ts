// =============================================================================
// Parser template import Master Barang — Excel multi-sheet + CSV flat/legacy
// =============================================================================

import * as XLSX from "xlsx";
import { resolveCategoryForAttributes } from "@/lib/category-attribute-map";
import {
  buildBulkMaterialName,
  buildProductNameFromTypeAttributes,
  buildProductSkuFromTypeAttributes,
  ensureUniqueSku,
} from "@/lib/product-name-builder";
import {
  TAIL_COLUMNS,
  LEGACY_COLUMNS,
  LEGACY_SHEET_NAME,
  type ProductCatalogForImport,
} from "@/lib/inventory-import-template";
import type { OnboardingInventoryItem } from "@/lib/apply-onboarding-inventory";
import type {
  ProductAttributeSelections,
  ProductType,
  ResolvedProductTypeAttribute,
} from "@/types/product-attributes";

const SKIP_SHEETS = new Set(["Panduan", "Referensi Attribute"]);

export interface ParsedImportRow {
  rowIndex: number;
  sheetName: string;
  categoryName: string;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  purchasePrice: number;
  sellPrice: number;
  initialStock: number;
  reorderPoint: number;
  warehouseLocation: string;
  markLegacy: boolean;
  valid: boolean;
  error: string | null;
  warnings: string[];
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parseIdr(value: string): number {
  const cleaned = value.replace(/[^\d.-]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parseLegacyFlag(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "y" || v === "ya" || v === "yes" || v === "true" || v === "1";
}

function isEmptyRow(values: string[]): boolean {
  return values.every((v) => !v.trim());
}

function listProductTypesForCategory(
  catalog: ProductCatalogForImport,
  categoryName: string,
): ProductType[] {
  const canonical = resolveCategoryForAttributes(categoryName);
  return catalog.productTypes.filter(
    (pt) => pt.categoryName === canonical && pt.isActive,
  );
}

function listAttributesForProductType(
  catalog: ProductCatalogForImport,
  productTypeId: string,
): ResolvedProductTypeAttribute[] {
  const gaMap = new Map(catalog.globalAttributes.map((g) => [g.id, g.name]));
  return catalog.typeAttributes
    .filter((ta) => ta.productTypeId === productTypeId && ta.isActive)
    .map((ta) => ({
      assignmentId: ta.id,
      globalAttributeId: ta.globalAttributeId,
      name: gaMap.get(ta.globalAttributeId) ?? "?",
      sortOrder: ta.sortOrder,
      isActive: ta.isActive,
      values: ta.values.filter((v) => v.isActive),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function findProductTypeByLabel(
  catalog: ProductCatalogForImport,
  categoryName: string,
  label: string,
): ProductType | undefined {
  const types = listProductTypesForCategory(catalog, categoryName);
  const normalized = label.trim().toLowerCase();
  return types.find((pt) => pt.name.trim().toLowerCase() === normalized);
}

function buildSelectionsFromCells(
  catalog: ProductCatalogForImport,
  productTypeId: string,
  cells: Record<string, string>,
): ProductAttributeSelections {
  const selections: ProductAttributeSelections = {};
  const attrs = listAttributesForProductType(catalog, productTypeId);
  for (const attr of attrs) {
    const raw = cellStr(cells[attr.name]);
    if (!raw) continue;
    const match = attr.values.find(
      (v) => v.label.trim().toLowerCase() === raw.toLowerCase(),
    );
    if (match) selections[attr.assignmentId] = match.id;
  }
  return selections;
}

function resolveStructuredNameSku(
  categoryName: string,
  cells: Record<string, string>,
  catalog: ProductCatalogForImport,
  takenSkus: Set<string>,
): { name: string; sku: string; warnings: string[]; error: string | null } {
  const warnings: string[] = [];
  const manualName = cellStr(cells["Nama Produk (opsional)"]);
  const manualSku = cellStr(cells["SKU (opsional)"]);
  const jenisBarang = cellStr(cells["Jenis Barang"]);

  if (manualName) {
    const sku = manualSku
      ? ensureUniqueSku(manualSku, takenSkus)
      : ensureUniqueSku(
          manualName
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 8)
            .toUpperCase() || "BRG",
          takenSkus,
        );
    if (!manualSku) warnings.push("SKU digenerate otomatis dari nama");
    return { name: manualName, sku, warnings, error: null };
  }

  if (!jenisBarang) {
    return {
      name: "",
      sku: "",
      warnings,
      error: "Isi Jenis Barang atau Nama Produk (opsional)",
    };
  }

  const productType = findProductTypeByLabel(catalog, categoryName, jenisBarang);
  if (!productType) {
    return {
      name: "",
      sku: "",
      warnings,
      error: `Jenis Barang "${jenisBarang}" tidak dikenali di kategori ${categoryName}`,
    };
  }

  const attrs = listAttributesForProductType(catalog, productType.id);
  const selections = buildSelectionsFromCells(catalog, productType.id, cells);
  const name = buildBulkMaterialName(
    productType,
    attrs,
    categoryName,
    selections,
  );
  const baseSku =
    manualSku || buildProductSkuFromTypeAttributes(productType, attrs, selections);
  const sku = ensureUniqueSku(baseSku || "BRG", takenSkus);

  if (!name.trim()) {
    return {
      name: "",
      sku: "",
      warnings,
      error: "Nama produk kosong — lengkapi attribute atau isi Nama Produk manual",
    };
  }

  return { name: name.trim(), sku, warnings, error: null };
}

function finalizeRow(
  partial: Omit<ParsedImportRow, "valid" | "error" | "warnings"> & {
    warnings?: string[];
  },
  takenSkus: Set<string>,
): ParsedImportRow {
  const warnings = [...(partial.warnings ?? [])];
  let error: string | null = null;

  if (!partial.name.trim()) error = "Nama produk wajib";
  else if (!partial.unit.trim()) error = "Satuan wajib";
  else if (partial.sellPrice <= 0) error = "Harga jual wajib diisi";
  else if (partial.sellPrice <= partial.purchasePrice) {
    error = "Harga jual harus lebih besar dari harga beli";
  }

  const sku = partial.sku.trim();
  if (!error && sku) {
    const upper = sku.toUpperCase();
    if (takenSkus.has(upper)) {
      error = `SKU duplikat dalam file: ${sku}`;
    } else {
      takenSkus.add(upper);
    }
  }

  return {
    ...partial,
    warnings,
    valid: !error,
    error,
  };
}

function parseTailFields(cells: Record<string, string>): Pick<
  ParsedImportRow,
  | "barcode"
  | "unit"
  | "purchasePrice"
  | "sellPrice"
  | "initialStock"
  | "reorderPoint"
  | "warehouseLocation"
  | "markLegacy"
> {
  return {
    barcode: cellStr(cells.Barcode),
    unit: cellStr(cells.Satuan) || "pcs",
    purchasePrice: parseIdr(cellStr(cells["Harga Beli"])),
    sellPrice: parseIdr(cellStr(cells["Harga Jual"])),
    initialStock: parseIdr(cellStr(cells["Stok Awal"])),
    reorderPoint: parseIdr(cellStr(cells["Reorder Point"])) || 5,
    warehouseLocation: cellStr(cells["Lokasi Gudang"]),
    markLegacy: parseLegacyFlag(cellStr(cells["Legacy Stock (Y/Tidak)"])),
  };
}

function parseLegacyCells(
  cells: Record<string, string>,
  rowIndex: number,
  takenSkus: Set<string>,
  catalog: ProductCatalogForImport,
): ParsedImportRow | null {
  const values = Object.values(cells);
  if (isEmptyRow(values)) return null;

  const categoryName =
    resolveCategoryForAttributes(cellStr(cells.Kategori)) || "Lainnya";
  const name = cellStr(cells["Nama Produk"]);
  const manualSku = cellStr(cells["SKU (opsional)"]);
  const tail = parseTailFields(cells);

  const sku = manualSku
    ? ensureUniqueSku(manualSku, takenSkus)
    : ensureUniqueSku(
        name
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 8)
          .toUpperCase() || "BRG",
        takenSkus,
      );

  const warnings: string[] = [];
  if (!manualSku) warnings.push("SKU digenerate otomatis");

  // Legacy path: allow unknown category names (map alias or keep as-is for ensureCategory)
  if (!listProductTypesForCategory(catalog, categoryName).length && categoryName !== "Lainnya") {
    warnings.push(`Kategori "${categoryName}" tidak punya attribute — disimpan sebagai master manual`);
  }

  return finalizeRow(
    {
      rowIndex,
      sheetName: LEGACY_SHEET_NAME,
      categoryName,
      name,
      sku,
      ...tail,
      warnings,
    },
    takenSkus,
  );
}

function parseStructuredCells(
  categoryName: string,
  cells: Record<string, string>,
  rowIndex: number,
  sheetName: string,
  catalog: ProductCatalogForImport,
  takenSkus: Set<string>,
): ParsedImportRow | null {
  const values = Object.values(cells);
  if (isEmptyRow(values)) return null;

  const resolvedCategory = resolveCategoryForAttributes(categoryName) || categoryName;
  const { name, sku, warnings, error: nameError } = resolveStructuredNameSku(
    resolvedCategory,
    cells,
    catalog,
    takenSkus,
  );
  const tail = parseTailFields(cells);

  const row = finalizeRow(
    {
      rowIndex,
      sheetName,
      categoryName: resolvedCategory,
      name,
      sku,
      ...tail,
      warnings,
    },
    takenSkus,
  );

  if (nameError) {
    return { ...row, valid: false, error: nameError };
  }
  return row;
}

function sheetToRecords(sheet: XLSX.WorkSheet, headerRowIndex: number): Record<string, string>[] {
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];
  const headers = (matrix[headerRowIndex] ?? []).map((h) => cellStr(h));
  if (headers.every((h) => !h)) return [];

  const records: Record<string, string>[] = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (isEmptyRow(row.map(cellStr))) continue;
    const cells: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (header) cells[header] = cellStr(row[idx]);
    });
    records.push({ ...cells, __rowIndex: String(i + 1) });
  }
  return records;
}

function parseExcelWorkbook(
  workbook: XLSX.WorkBook,
  catalog: ProductCatalogForImport,
  existingSkus: string[],
): ParsedImportRow[] {
  const takenSkus = new Set(existingSkus.map((s) => s.trim().toUpperCase()));
  const rows: ParsedImportRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (SKIP_SHEETS.has(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    if (sheetName === LEGACY_SHEET_NAME) {
      const records = sheetToRecords(sheet, 1);
      for (const cells of records) {
        const rowIndex = Number(cells.__rowIndex ?? 0);
        delete cells.__rowIndex;
        const parsed = parseLegacyCells(cells, rowIndex, takenSkus, catalog);
        if (parsed) rows.push(parsed);
      }
      continue;
    }

    // Category sheets: row 2 = headers (index 1), data from row 4+ (skip example row 3)
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as string[][];
    const headers = (matrix[1] ?? []).map((h) => cellStr(h));
    if (headers.every((h) => !h)) continue;

    for (let i = 3; i < matrix.length; i++) {
      const rowArr = matrix[i] ?? [];
      if (isEmptyRow(rowArr.map(cellStr))) continue;
      const cells: Record<string, string> = {};
      headers.forEach((header, idx) => {
        if (header) cells[header] = cellStr(rowArr[idx]);
      });
      const parsed = parseStructuredCells(
        sheetName,
        cells,
        i + 1,
        sheetName,
        catalog,
        takenSkus,
      );
      if (parsed) rows.push(parsed);
    }
  }

  return rows;
}

function parseCsvText(text: string, catalog: ProductCatalogForImport, existingSkus: string[]): ParsedImportRow[] {
  const workbook = XLSX.read(text, { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) return [];

  const takenSkus = new Set(existingSkus.map((s) => s.trim().toUpperCase()));
  const records = sheetToRecords(sheet, 0);
  const rows: ParsedImportRow[] = [];

  for (const cells of records) {
    const rowIndex = Number(cells.__rowIndex ?? 0);
    delete cells.__rowIndex;
    const hasLegacy = LEGACY_COLUMNS.every((col) => col in cells || col === "Kategori");
    const isLegacyFormat = cellStr(cells["Nama Produk"]) && !cellStr(cells["Jenis Barang"]);

    if (isLegacyFormat || (hasLegacy && cellStr(cells["Nama Produk"]))) {
      const parsed = parseLegacyCells(cells, rowIndex, takenSkus, catalog);
      if (parsed) rows.push(parsed);
      continue;
    }

    const categoryName =
      resolveCategoryForAttributes(cellStr(cells.Kategori)) ||
      cellStr(cells.Kategori) ||
      "Lainnya";
    const parsed = parseStructuredCells(
      categoryName,
      cells,
      rowIndex,
      "CSV",
      catalog,
      takenSkus,
    );
    if (parsed) rows.push(parsed);
  }

  return rows;
}

export async function parseImportFile(
  file: File,
  catalog: ProductCatalogForImport,
  existingSkus: string[],
): Promise<ParsedImportRow[]> {
  const lower = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (lower.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
    return parseCsvText(text, catalog, existingSkus);
  }

  const workbook = XLSX.read(buffer, { type: "array" });
  return parseExcelWorkbook(workbook, catalog, existingSkus);
}

export function parsedRowsToInventoryItems(rows: ParsedImportRow[]): OnboardingInventoryItem[] {
  return rows
    .filter((r) => r.valid)
    .map((r) => ({
      sku: r.sku,
      name: r.name,
      unit: r.unit,
      categoryName: r.categoryName || "Lainnya",
      sellPrice: r.sellPrice,
      purchasePrice: r.purchasePrice,
      initialStock: r.initialStock,
      markLegacy: r.markLegacy,
      barcode: r.barcode || null,
      reorderPoint: r.reorderPoint,
      warehouseLocation: r.warehouseLocation,
    }));
}

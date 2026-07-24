// =============================================================================
// Template import Master Barang — multi-sheet Excel + CSV per kategori.
// =============================================================================

import * as XLSX from "xlsx";
import { SEED_PRODUCT_ATTRIBUTE_CATEGORIES } from "@/lib/mock-product-attributes";
import { listActiveAttributesForCategory } from "@/lib/product-name-builder";
import type { ProductAttributeDefinition } from "@/types/product-attributes";

const TAIL_COLUMNS = [
  "Nama Produk (opsional)",
  "SKU (opsional)",
  "Barcode",
  "Satuan",
  "Harga Beli",
  "Harga Jual",
  "Stok Awal",
  "Reorder Point",
  "Lokasi Gudang",
  "Legacy Stock (Y/Tidak)",
] as const;

/** Contoh baris per kategori — nilai attribute harus cocok dengan seed / referensi. */
const EXAMPLE_ROWS: Record<string, Record<string, string>> = {
  "Pipa & Sanitasi": {
    Jenis: "Pipa PVC",
    Bahan: "PVC",
    Ukuran: '3/4"',
    Spesifikasi: "AW",
    Merk: "Rucika",
    "Nama Produk (opsional)": "",
    "SKU (opsional)": "",
    Barcode: "",
    Satuan: "btg",
    "Harga Beli": "15000",
    "Harga Jual": "22000",
    "Stok Awal": "50",
    "Reorder Point": "10",
    "Lokasi Gudang": "D-01",
    "Legacy Stock (Y/Tidak)": "Tidak",
  },
  "Besi & Logam": {
    Jenis: "Besi Hollow",
    Ukuran: "4x4 cm",
    Spesifikasi: "Galvanis",
    Merk: "Krakatau",
    "Nama Produk (opsional)": "",
    "SKU (opsional)": "",
    Barcode: "",
    Satuan: "btg",
    "Harga Beli": "75000",
    "Harga Jual": "105000",
    "Stok Awal": "25",
    "Reorder Point": "10",
    "Lokasi Gudang": "F-02",
    "Legacy Stock (Y/Tidak)": "Tidak",
  },
  "Cat & Pelapis": {
    Jenis: "Cat Tembok",
    Kemasan: "5 kg",
    Varian: "Putih",
    Merk: "Dulux",
    "Nama Produk (opsional)": "",
    "SKU (opsional)": "",
    Barcode: "",
    Satuan: "kaleng",
    "Harga Beli": "38000",
    "Harga Jual": "45000",
    "Stok Awal": "20",
    "Reorder Point": "5",
    "Lokasi Gudang": "C-02",
    "Legacy Stock (Y/Tidak)": "Tidak",
  },
  "Semen & Bahan Bangunan": {
    Jenis: "Semen Portland",
    Ukuran: "50 kg",
    Merk: "Tiga Roda",
    "Nama Produk (opsional)": "",
    "SKU (opsional)": "",
    Barcode: "",
    Satuan: "sak",
    "Harga Beli": "57000",
    "Harga Jual": "65000",
    "Stok Awal": "80",
    "Reorder Point": "20",
    "Lokasi Gudang": "A-01",
    "Legacy Stock (Y/Tidak)": "Tidak",
  },
  "Keramik & Lantai": {
    Jenis: "Keramik Lantai",
    Ukuran: "40x40",
    Varian: "Putih",
    Merk: "Roman",
    "Nama Produk (opsional)": "",
    "SKU (opsional)": "",
    Barcode: "",
    Satuan: "dus",
    "Harga Beli": "65000",
    "Harga Jual": "78000",
    "Stok Awal": "30",
    "Reorder Point": "10",
    "Lokasi Gudang": "E-01",
    "Legacy Stock (Y/Tidak)": "Tidak",
  },
  "Kayu & Triplek": {
    Jenis: "Triplek",
    Ukuran: "9 mm",
    Grade: "MR",
    Merk: "Jaya Wood",
    "Nama Produk (opsional)": "",
    "SKU (opsional)": "",
    Barcode: "",
    Satuan: "lbr",
    "Harga Beli": "95000",
    "Harga Jual": "120000",
    "Stok Awal": "40",
    "Reorder Point": "15",
    "Lokasi Gudang": "G-01",
    "Legacy Stock (Y/Tidak)": "Tidak",
  },
  "Pasir & Material Curah": {
    Jenis: "Pasir Lumajang",
    "Satuan Jual": "per Truk",
    Sumber: "Lumajang",
    "Nama Produk (opsional)": "Pasir Lumajang / Truk",
    "SKU (opsional)": "",
    Barcode: "",
    Satuan: "truk",
    "Harga Beli": "1200000",
    "Harga Jual": "1450000",
    "Stok Awal": "0",
    "Reorder Point": "0",
    "Lokasi Gudang": "A-04",
    "Legacy Stock (Y/Tidak)": "Tidak",
  },
};

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, "").slice(0, 31);
}

function buildHeaders(attributes: ProductAttributeDefinition[], categoryName: string): string[] {
  const attrs = listActiveAttributesForCategory(attributes, categoryName);
  return [...attrs.map((a) => a.name), ...TAIL_COLUMNS];
}

function buildExampleRow(
  attributes: ProductAttributeDefinition[],
  categoryName: string,
): string[] {
  const headers = buildHeaders(attributes, categoryName);
  const sample = EXAMPLE_ROWS[categoryName] ?? {};
  return headers.map((h) => sample[h] ?? "");
}

function buildGuideSheet(): string[][] {
  return [
    ["PANDUAN TEMPLATE IMPORT MASTER BARANG"],
    [""],
    ["Struktur file"],
    ["• Setiap sheet (tab) = satu kategori barang"],
    ["• Baris 1 = petunjuk sheet, Baris 2 = header kolom, Baris 3 = contoh, Baris 4+ = data Anda"],
    ["• Kolom attribute harus diisi persis seperti nilai di sheet Referensi Attribute"],
    [""],
    ["Nama & SKU otomatis"],
    ["• Kosongkan Nama Produk dan SKU → sistem generate dari attribute (Smart Product Name Builder)"],
    ["• Isi manual hanya jika ingin override"],
    [""],
    ["Material curah (Pasir & Material Curah)"],
    ["• Buat produk TERPISAH per satuan jual: Pasir Lumajang / Truk vs Pasir Lumajang / Pikap"],
    ["• Pilih Jenis + Satuan Jual berbeda pada baris berbeda"],
    [""],
    ["Validasi saat import"],
    ["• Harga Jual HARUS lebih besar dari Harga Beli"],
    ["• Satuan, Harga Beli, Harga Jual wajib diisi"],
    ["• Legacy Stock: Y atau Tidak"],
    [""],
    ["Format unduhan"],
    ["• Excel (.xlsx): multi-sheet — disarankan untuk import"],
    ["• CSV (.zip): satu file CSV per kategori — untuk edit di Notepad / sistem lain"],
    [""],
    ["Setelah mengisi, gunakan tombol Import Excel di halaman Master Barang."],
  ];
}

function buildReferenceSheet(attributes: ProductAttributeDefinition[]): string[][] {
  const rows: string[][] = [
    ["Kategori", "Attribute", "Nilai (isi persis)", "Singkatan SKU"],
  ];
  for (const category of SEED_PRODUCT_ATTRIBUTE_CATEGORIES) {
    const attrs = listActiveAttributesForCategory(attributes, category);
    for (const attr of attrs) {
      for (const val of attr.values.filter((v) => v.isActive).sort((a, b) => a.sortOrder - b.sortOrder)) {
        rows.push([category, attr.name, val.label, val.abbreviation]);
      }
    }
  }
  return rows;
}

function buildCategorySheetData(
  attributes: ProductAttributeDefinition[],
  categoryName: string,
): string[][] {
  const headers = buildHeaders(attributes, categoryName);
  const note = `Kategori: ${categoryName} — isi dari baris 4. Jangan ubah header baris 2.`;
  return [
    [note],
    headers,
    buildExampleRow(attributes, categoryName),
    headers.map(() => ""),
  ];
}

export function buildImportTemplateWorkbook(
  attributes: ProductAttributeDefinition[],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildGuideSheet()), "Panduan");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(buildReferenceSheet(attributes)),
    "Referensi Attribute",
  );

  for (const category of SEED_PRODUCT_ATTRIBUTE_CATEGORIES) {
    const sheetData = buildCategorySheetData(attributes, category);
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(sheetData),
      sanitizeSheetName(category),
    );
  }

  return wb;
}

export function downloadImportTemplateExcel(attributes: ProductAttributeDefinition[]): void {
  const wb = buildImportTemplateWorkbook(attributes);
  XLSX.writeFile(wb, "template-import-barang.xlsx");
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function sheetToCsv(sheetData: string[][]): string {
  return sheetData.map((row) => row.map((c) => escapeCsvCell(String(c ?? ""))).join(",")).join("\r\n");
}

/** Semua kolom attribute (union) untuk satu file CSV flat. */
function buildWideCsvHeaders(attributes: ProductAttributeDefinition[]): string[] {
  const attrNames = new Set<string>();
  for (const category of SEED_PRODUCT_ATTRIBUTE_CATEGORIES) {
    for (const a of listActiveAttributesForCategory(attributes, category)) {
      attrNames.add(a.name);
    }
  }
  return ["Kategori", ...Array.from(attrNames).sort(), ...TAIL_COLUMNS];
}

function buildWideCsvRows(attributes: ProductAttributeDefinition[]): string[][] {
  const headers = buildWideCsvHeaders(attributes);
  const rows: string[][] = [headers];

  for (const category of SEED_PRODUCT_ATTRIBUTE_CATEGORIES) {
    const sample = EXAMPLE_ROWS[category] ?? {};
    const categoryAttrs = listActiveAttributesForCategory(attributes, category);
    const exampleRow = headers.map((h) => {
      if (h === "Kategori") return category;
      if ((TAIL_COLUMNS as readonly string[]).includes(h)) return sample[h] ?? "";
      if (categoryAttrs.some((a) => a.name === h)) return sample[h] ?? "";
      return "";
    });
    rows.push(exampleRow);
    rows.push(headers.map((h) => (h === "Kategori" ? category : "")));
  }

  return rows;
}

/** Satu file CSV — kolom Kategori + attribute (flat). */
export function downloadImportTemplateCsv(attributes: ProductAttributeDefinition[]): void {
  const csv = sheetToCsv(buildWideCsvRows(attributes));
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template-import-barang.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { TAIL_COLUMNS, buildHeaders, buildCategorySheetData };

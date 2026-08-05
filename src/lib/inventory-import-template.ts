// =============================================================================
// Template import Master Barang — multi-sheet Excel + CSV per kategori.
// =============================================================================

import * as XLSX from "xlsx";
import { SEED_PRODUCT_ATTRIBUTE_CATEGORIES } from "@/lib/product-catalog-seed";
import { resolveCategoryForAttributes } from "@/lib/category-attribute-map";
import type {
  GlobalAttribute,
  ProductType,
  ProductTypeAttribute,
} from "@/types/product-attributes";

export interface ProductCatalogForImport {
  globalAttributes: GlobalAttribute[];
  productTypes: ProductType[];
  typeAttributes: ProductTypeAttribute[];
}

function getCategoryAttributeNames(
  catalog: ProductCatalogForImport,
  categoryName: string,
): string[] {
  const canonical = resolveCategoryForAttributes(categoryName);
  const gaMap = new Map(catalog.globalAttributes.map((g) => [g.id, g.name]));
  const names = new Set<string>();
  for (const pt of catalog.productTypes.filter(
    (p) => p.categoryName === canonical && p.isActive,
  )) {
    for (const ta of catalog.typeAttributes.filter(
      (t) => t.productTypeId === pt.id && t.isActive,
    )) {
      const n = gaMap.get(ta.globalAttributeId);
      if (n) names.add(n);
    }
  }
  return Array.from(names).sort();
}

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
  "Semen & Beton": {
    "Jenis Barang": "Semen Portland",
    Kemasan: "50 kg",
    Tipe: "Standard",
    Aplikasi: "Struktur / Cor",
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
  "Bata & Blok": {
    "Jenis Barang": "Bata Merah",
    Ukuran: "Standard",
    Kualitas: "Kelas I",
    Merk: "Lokal / Custom",
    "Nama Produk (opsional)": "",
    "SKU (opsional)": "",
    Barcode: "",
    Satuan: "pcs",
    "Harga Beli": "800",
    "Harga Jual": "1100",
    "Stok Awal": "1200",
    "Reorder Point": "500",
    "Lokasi Gudang": "B-03",
    "Legacy Stock (Y/Tidak)": "Tidak",
  },
  "Cat & Finishing": {
    "Jenis Barang": "Cat Tembok",
    Kemasan: "5 kg",
    Finishing: "Interior",
    Warna: "Putih",
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
  "Pipa & Sanitasi": {
    "Jenis Barang": "Pipa PVC",
    Bahan: "PVC",
    Ukuran: '3/4"',
    Kelas: "AW (Air Bersih)",
    Aplikasi: "Instalasi Air Bersih",
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
    "Jenis Barang": "Besi Hollow",
    Ukuran: "4x4 cm",
    Panjang: "6 m",
    Spesifikasi: "Galvanis",
    Aplikasi: "Rangka / Hollow",
    Merk: "Krakatau Steel",
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
  "Keramik & Lantai": {
    "Jenis Barang": "Keramik Lantai",
    Ukuran: "40x40 cm",
    Finish: "Glazur / Kilat",
    "Warna / Motif": "Putih",
    Tebal: "8 mm",
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
    "Jenis Barang": "Triplek",
    Ukuran: "9 mm",
    Grade: "MR (Moisture Resistant)",
    Treatment: "Standar",
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
  "Atap & Rangka": {
    "Jenis Barang": "Genteng Beton",
    Ukuran: "Standard",
    Material: "Beton",
    Warna: "Merah",
    Merk: "Mulia / Multi",
    "Nama Produk (opsional)": "",
    "SKU (opsional)": "",
    Barcode: "",
    Satuan: "pcs",
    "Harga Beli": "3500",
    "Harga Jual": "5000",
    "Stok Awal": "200",
    "Reorder Point": "100",
    "Lokasi Gudang": "H-02",
    "Legacy Stock (Y/Tidak)": "Tidak",
  },
  Listrik: {
    "Jenis Barang": "Kabel",
    Kapasitas: "2.5 mm²",
    Spesifikasi: "NYM",
    "Warna Kabel": "Campuran / Roll",
    Merk: "Panasonic",
    "Nama Produk (opsional)": "",
    "SKU (opsional)": "",
    Barcode: "",
    Satuan: "rol",
    "Harga Beli": "320000",
    "Harga Jual": "395000",
    "Stok Awal": "9",
    "Reorder Point": "4",
    "Lokasi Gudang": "I-01",
    "Legacy Stock (Y/Tidak)": "Tidak",
  },
  "Pasir & Material Curah": {
    "Jenis Barang": "Pasir Lumajang",
    "Satuan Jual": "per Truk",
    Sumber: "Lumajang",
    Gradasi: "Halus",
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

function buildHeaders(catalog: ProductCatalogForImport, categoryName: string): string[] {
  const attrs = getCategoryAttributeNames(catalog, categoryName);
  return ["Jenis Barang", ...attrs, ...TAIL_COLUMNS];
}

function buildExampleRow(catalog: ProductCatalogForImport, categoryName: string): string[] {
  const headers = buildHeaders(catalog, categoryName);
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
    ["• Pilih Jenis Barang + Satuan Jual berbeda pada baris berbeda"],
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

function buildReferenceSheet(catalog: ProductCatalogForImport): string[][] {
  const rows: string[][] = [
    ["Kategori", "Jenis Barang", "Attribute", "Nilai (isi persis)", "Singkatan SKU"],
  ];
  const gaMap = new Map(catalog.globalAttributes.map((g) => [g.id, g.name]));
  const ptMap = new Map(catalog.productTypes.map((p) => [p.id, p.name]));
  for (const category of SEED_PRODUCT_ATTRIBUTE_CATEGORIES) {
    const canonical = resolveCategoryForAttributes(category);
    for (const ta of catalog.typeAttributes.filter((t) => t.isActive)) {
      const pt = catalog.productTypes.find((p) => p.id === ta.productTypeId);
      if (!pt || pt.categoryName !== canonical) continue;
      const attrName = gaMap.get(ta.globalAttributeId) ?? "?";
      for (const val of ta.values
        .filter((v) => v.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)) {
        rows.push([category, ptMap.get(ta.productTypeId) ?? pt.name, attrName, val.label, val.abbreviation]);
      }
    }
  }
  return rows;
}

function buildCategorySheetData(
  catalog: ProductCatalogForImport,
  categoryName: string,
): string[][] {
  const headers = buildHeaders(catalog, categoryName);
  const note = `Kategori: ${categoryName} — isi dari baris 4. Jangan ubah header baris 2.`;
  return [
    [note],
    headers,
    buildExampleRow(catalog, categoryName),
    headers.map(() => ""),
  ];
}

export function buildImportTemplateWorkbook(catalog: ProductCatalogForImport): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildGuideSheet()), "Panduan");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(buildReferenceSheet(catalog)),
    "Referensi Attribute",
  );

  for (const category of SEED_PRODUCT_ATTRIBUTE_CATEGORIES) {
    const sheetData = buildCategorySheetData(catalog, category);
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(sheetData),
      sanitizeSheetName(category),
    );
  }

  return wb;
}

export function downloadImportTemplateExcel(catalog: ProductCatalogForImport): void {
  const wb = buildImportTemplateWorkbook(catalog);
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
function buildWideCsvHeaders(catalog: ProductCatalogForImport): string[] {
  const attrNames = new Set<string>();
  for (const category of SEED_PRODUCT_ATTRIBUTE_CATEGORIES) {
    for (const n of getCategoryAttributeNames(catalog, category)) {
      attrNames.add(n);
    }
  }
  return ["Kategori", "Jenis Barang", ...Array.from(attrNames).sort(), ...TAIL_COLUMNS];
}

function buildWideCsvRows(catalog: ProductCatalogForImport): string[][] {
  const headers = buildWideCsvHeaders(catalog);
  const rows: string[][] = [headers];

  for (const category of SEED_PRODUCT_ATTRIBUTE_CATEGORIES) {
    const sample = EXAMPLE_ROWS[category] ?? {};
    const categoryAttrs = getCategoryAttributeNames(catalog, category);
    const exampleRow = headers.map((h) => {
      if (h === "Kategori") return category;
      if ((TAIL_COLUMNS as readonly string[]).includes(h)) return sample[h] ?? "";
      if (h === "Jenis Barang" || categoryAttrs.includes(h)) return sample[h] ?? "";
      return "";
    });
    rows.push(exampleRow);
    rows.push(headers.map((h) => (h === "Kategori" ? category : "")));
  }

  return rows;
}

/** Satu file CSV — kolom Kategori + attribute (flat). */
export function downloadImportTemplateCsv(catalog: ProductCatalogForImport): void {
  const csv = sheetToCsv(buildWideCsvRows(catalog));
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

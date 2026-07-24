// =============================================================================
// Seed — attribute produk per kategori toko bangunan (demo).
// =============================================================================

import type { ProductAttributeDefinition } from "@/types/product-attributes";

function val(
  id: string,
  label: string,
  abbreviation: string,
  sortOrder: number,
): ProductAttributeDefinition["values"][0] {
  return { id, label, abbreviation, sortOrder, isActive: true };
}

function attr(
  id: string,
  categoryName: string,
  name: string,
  sortOrder: number,
  values: ProductAttributeDefinition["values"],
): ProductAttributeDefinition {
  return { id, categoryName, name, sortOrder, isActive: true, values };
}

export const SEED_PRODUCT_ATTRIBUTE_CATEGORIES = [
  "Pipa & Sanitasi",
  "Besi & Logam",
  "Cat & Pelapis",
  "Semen & Bahan Bangunan",
  "Keramik & Lantai",
  "Kayu & Triplek",
  "Pasir & Material Curah",
] as const;

export function getSeedProductAttributes(): ProductAttributeDefinition[] {
  return [
    attr("attr-pipa-jenis", "Pipa & Sanitasi", "Jenis", 1, [
      val("pv-pip-1", "Pipa PVC", "PIP", 1),
      val("pv-pip-2", "Pipa HDPE", "HDPE", 2),
      val("pv-pip-3", "Kran Air", "KRN", 3),
      val("pv-pip-4", "Fitting PVC", "FIT", 4),
      val("pv-pip-5", "Closet", "CLS", 5),
    ]),
    attr("attr-pipa-bahan", "Pipa & Sanitasi", "Bahan", 2, [
      val("pv-bhn-1", "PVC", "PVC", 1),
      val("pv-bhn-2", "HDPE", "HDPE", 2),
      val("pv-bhn-3", "Stainless", "SS", 3),
      val("pv-bhn-4", "Kuningan", "KNS", 4),
    ]),
    attr("attr-pipa-ukuran", "Pipa & Sanitasi", "Ukuran", 3, [
      val("pv-uk-1", '1/2"', "12", 1),
      val("pv-uk-2", '3/4"', "34", 2),
      val("pv-uk-3", '1"', "1", 3),
      val("pv-uk-4", '2"', "2", 4),
      val("pv-uk-5", '4"', "4", 5),
    ]),
    attr("attr-pipa-spes", "Pipa & Sanitasi", "Spesifikasi", 4, [
      val("pv-sp-1", "AW", "AW", 1),
      val("pv-sp-2", "D", "D", 2),
      val("pv-sp-3", "Rucika Standard", "STD", 3),
      val("pv-sp-4", "Rucika JIS", "JIS", 4),
    ]),
    attr("attr-pipa-merk", "Pipa & Sanitasi", "Merk", 5, [
      val("pv-mk-1", "Rucika", "RUC", 1),
      val("pv-mk-2", "Wavin", "WAV", 2),
      val("pv-mk-3", "Roto", "ROT", 3),
      val("pv-mk-4", "Onda", "OND", 4),
    ]),

    attr("attr-besi-jenis", "Besi & Logam", "Jenis", 1, [
      val("bs-jn-1", "Besi Beton", "BTN", 1),
      val("bs-jn-2", "Besi Hollow", "HOL", 2),
      val("bs-jn-3", "Besi Siku", "SIK", 3),
      val("bs-jn-4", "Kawat Beton", "KWT", 4),
      val("bs-jn-5", "Paku", "PAK", 5),
    ]),
    attr("attr-besi-ukuran", "Besi & Logam", "Ukuran", 2, [
      val("bs-uk-1", "8 mm", "8", 1),
      val("bs-uk-2", "10 mm", "10", 2),
      val("bs-uk-3", "12 mm", "12", 3),
      val("bs-uk-4", "4x4 cm", "4X4", 4),
      val("bs-uk-5", "1 kg", "1KG", 5),
    ]),
    attr("attr-besi-spes", "Besi & Logam", "Spesifikasi", 3, [
      val("bs-sp-1", "Polos", "PLS", 1),
      val("bs-sp-2", "Ulir", "ULR", 2),
      val("bs-sp-3", "Galvanis", "GLV", 3),
    ]),
    attr("attr-besi-merk", "Besi & Logam", "Merk", 4, [
      val("bs-mk-1", "Krakatau", "KRA", 1),
      val("bs-mk-2", "Master Steel", "MST", 2),
      val("bs-mk-3", "Gunung Garuda", "GGD", 3),
    ]),

    attr("attr-cat-jenis", "Cat & Pelapis", "Jenis", 1, [
      val("ct-jn-1", "Cat Tembok", "TMB", 1),
      val("ct-jn-2", "Cat Kayu", "KYU", 2),
      val("ct-jn-3", "Cat Besi", "BSI", 3),
      val("ct-jn-4", "Plamur", "PLM", 4),
      val("ct-jn-5", "Waterproofing", "WPF", 5),
    ]),
    attr("attr-cat-kemasan", "Cat & Pelapis", "Kemasan", 2, [
      val("ct-km-1", "1 kg", "1KG", 1),
      val("ct-km-2", "5 kg", "5KG", 2),
      val("ct-km-3", "20 kg", "20KG", 3),
      val("ct-km-4", "25 kg", "25KG", 4),
    ]),
    attr("attr-cat-varian", "Cat & Pelapis", "Varian", 3, [
      val("ct-vr-1", "Putih", "WHT", 1),
      val("ct-vr-2", "Hitam", "BLK", 2),
      val("ct-vr-3", "Kuning", "YLW", 3),
      val("ct-vr-4", "Merah", "RED", 4),
      val("ct-vr-5", "Interior", "INT", 5),
      val("ct-vr-6", "Exterior", "EXT", 6),
    ]),
    attr("attr-cat-merk", "Cat & Pelapis", "Merk", 4, [
      val("ct-mk-1", "Dulux", "DLX", 1),
      val("ct-mk-2", "Avian", "AVN", 2),
      val("ct-mk-3", "Nippon", "NPP", 3),
      val("ct-mk-4", "Propaint", "PRP", 4),
    ]),

    attr("attr-smn-jenis", "Semen & Bahan Bangunan", "Jenis", 1, [
      val("sm-jn-1", "Semen Portland", "SEM", 1),
      val("sm-jn-2", "Mortar", "MRT", 2),
      val("sm-jn-3", "Bata Merah", "BMR", 3),
      val("sm-jn-4", "Bata Ringan", "BRG", 4),
      val("sm-jn-5", "Batako", "BTK", 5),
      val("sm-jn-6", "Hebel", "HBL", 6),
    ]),
    attr("attr-smn-ukuran", "Semen & Bahan Bangunan", "Ukuran", 2, [
      val("sm-uk-1", "40 kg", "40KG", 1),
      val("sm-uk-2", "50 kg", "50KG", 2),
      val("sm-uk-3", "7.5 cm", "75", 3),
      val("sm-uk-4", "10 cm", "10", 4),
    ]),
    attr("attr-smn-merk", "Semen & Bahan Bangunan", "Merk", 3, [
      val("sm-mk-1", "Tiga Roda", "TRD", 1),
      val("sm-mk-2", "Gresik", "GRS", 2),
      val("sm-mk-3", "Holcim", "HLC", 3),
      val("sm-mk-4", "Hebel AAC", "AAC", 4),
    ]),

    attr("attr-krm-jenis", "Keramik & Lantai", "Jenis", 1, [
      val("kr-jn-1", "Keramik Lantai", "KLT", 1),
      val("kr-jn-2", "Keramik Dinding", "KDN", 2),
      val("kr-jn-3", "Granit", "GRT", 3),
      val("kr-jn-4", "Homogen", "HMG", 4),
    ]),
    attr("attr-krm-ukuran", "Keramik & Lantai", "Ukuran", 2, [
      val("kr-uk-1", "20x20", "2020", 1),
      val("kr-uk-2", "30x30", "3030", 2),
      val("kr-uk-3", "40x40", "4040", 3),
      val("kr-uk-4", "60x60", "6060", 4),
    ]),
    attr("attr-krm-varian", "Keramik & Lantai", "Varian", 3, [
      val("kr-vr-1", "Putih", "WHT", 1),
      val("kr-vr-2", "Abu", "GRY", 2),
      val("kr-vr-3", "Coklat", "BRN", 3),
      val("kr-vr-4", "Marmer", "MRM", 4),
    ]),
    attr("attr-krm-merk", "Keramik & Lantai", "Merk", 4, [
      val("kr-mk-1", "Roman", "ROM", 1),
      val("kr-mk-2", "Ikea", "IKA", 2),
      val("kr-mk-3", "Mulia", "MUL", 3),
      val("kr-mk-4", "Asia Tile", "AST", 4),
    ]),

    attr("attr-kyu-jenis", "Kayu & Triplek", "Jenis", 1, [
      val("ky-jn-1", "Triplek", "TPL", 1),
      val("ky-jn-2", "Kayu Meranti", "MRT", 2),
      val("ky-jn-3", "Kayu Jati", "JTI", 3),
      val("ky-jn-4", "Reng", "RNG", 4),
      val("ky-jn-5", "Papan", "PPN", 5),
    ]),
    attr("attr-kyu-ukuran", "Kayu & Triplek", "Ukuran", 2, [
      val("ky-uk-1", "3 mm", "3MM", 1),
      val("ky-uk-2", "9 mm", "9MM", 2),
      val("ky-uk-3", "12 mm", "12MM", 3),
      val("ky-uk-4", "18 mm", "18MM", 4),
      val("ky-uk-5", "4x6 cm", "4X6", 5),
    ]),
    attr("attr-kyu-grade", "Kayu & Triplek", "Grade", 3, [
      val("ky-gr-1", "A", "A", 1),
      val("ky-gr-2", "B", "B", 2),
      val("ky-gr-3", "BC", "BC", 3),
      val("ky-gr-4", "MR", "MR", 4),
    ]),
    attr("attr-kyu-merk", "Kayu & Triplek", "Merk", 4, [
      val("ky-mk-1", "Jaya Wood", "JWD", 1),
      val("ky-mk-2", "Local", "LOC", 2),
      val("ky-mk-3", "Pertiwi", "PTW", 3),
    ]),

    attr("attr-ps-jenis", "Pasir & Material Curah", "Jenis", 1, [
      val("ps-jn-1", "Pasir Lumajang", "PLM", 1),
      val("ps-jn-2", "Pasir Putih", "PPT", 2),
      val("ps-jn-3", "Batu Split", "SPL", 3),
      val("ps-jn-4", "Kerikil", "KRK", 4),
      val("ps-jn-5", "Tanah Urug", "TUR", 5),
    ]),
    attr("attr-ps-satuan", "Pasir & Material Curah", "Satuan Jual", 2, [
      val("ps-st-1", "per m³", "M3", 1),
      val("ps-st-2", "per Pikap", "PKP", 2),
      val("ps-st-3", "per Truk", "TRK", 3),
      val("ps-st-4", "per Rit", "RIT", 4),
    ]),
    attr("attr-ps-sumber", "Pasir & Material Curah", "Sumber", 3, [
      val("ps-sm-1", "Lumajang", "LMJ", 1),
      val("ps-sm-2", "Bogor", "BGR", 2),
      val("ps-sm-3", "Karawang", "KRW", 3),
      val("ps-sm-4", "Lokal", "LOC", 4),
    ]),
  ];
}

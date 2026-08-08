/** Batas rekomendasi: di bawah ini cukup tambah manual, di atas gunakan import template. */
export const INVENTORY_BULK_INPUT_THRESHOLD = 10;

export const INVENTORY_INPUT_GUIDE = {
  manual:
    "Tambah Produk — cocok untuk kurang dari 10 barang atau input satu per satu.",
  bulk:
    "Import Excel/CSV — wajib untuk 10+ barang agar data terstruktur dan cepat.",
  legacy:
    "Sheet Data Legacy — untuk data lama dari buku/Excel toko (tanpa attribute detail).",
} as const;

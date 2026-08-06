/** Map raw Postgres / Drizzle errors to user-facing Indonesian messages. */
export function formatDbError(err: unknown, context?: string): string {
  const raw = err instanceof Error ? err.message : String(err);

  // Full detail in server logs — safe for operators, not shown to cashier UI.
  console.error(`[SEPS] db error${context ? ` (${context})` : ""}:`, raw);

  if (raw.includes("STOCK_DEFICIT")) {
    const sku = raw.split(":").slice(1).join(":").trim();
    return sku
      ? `Stok tidak cukup (${sku}). Periksa stok barang di Master Barang.`
      : "Stok tidak cukup. Periksa stok barang di Master Barang.";
  }
  if (raw.includes("CREDIT_EXCEEDED")) {
    return "Limit kredit pelanggan terlampaui.";
  }
  if (raw.includes("duplicate key") || raw.includes("unique constraint")) {
    if (raw.includes("transaction_number")) {
      return "Nomor transaksi bentrok. Coba lagi — sistem akan memakai nomor berikutnya.";
    }
    if (raw.includes("client_tx_id")) {
      return "Transaksi sudah pernah disinkronkan.";
    }
  }
  if (raw.includes("invalid input syntax for type uuid")) {
    return "Data transaksi tidak valid (UUID). Muat ulang halaman dan coba lagi.";
  }
  if (raw.includes("does not exist") && raw.includes("column")) {
    return "Database belum di-update. Hubungi developer untuk menjalankan migrasi Neon.";
  }
  if (raw.includes("foreign key constraint")) {
    if (raw.includes("session_id")) {
      return "Sesi kasir tidak valid. Tutup shift lalu buka sesi baru.";
    }
    if (raw.includes("input_by") || raw.includes("paid_by")) {
      return "Akun kasir tidak valid. Logout lalu login kembali.";
    }
    return "Referensi data tidak ditemukan. Muat ulang halaman dan coba lagi.";
  }

  if (raw.startsWith("Failed query:")) {
    const tableMatch = raw.match(/insert into "([^"]+)"/i);
    if (tableMatch) {
      return `Gagal menyimpan data (${tableMatch[1]}). Tutup shift, buka sesi baru, lalu coba lagi.`;
    }
    return "Gagal menyimpan transaksi ke database. Tutup shift, buka sesi baru, lalu coba lagi.";
  }

  return raw.length > 180 ? `${raw.slice(0, 177)}…` : raw;
}

/** Normalize optional UUID fields — empty string breaks Postgres uuid columns. */
export function nullIfEmptyUuid(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return value;
}

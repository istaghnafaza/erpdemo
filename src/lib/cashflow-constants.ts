// =============================================================================
// Kategori buku kas yang dipakai P&L, transfer internal, dan modal owner.
// =============================================================================

export const TRANSFER_OUT_CATEGORY = "Transfer Keluar";
export const TRANSFER_IN_CATEGORY = "Transfer Masuk";
export const PRIVE_CATEGORY = "Prive";
export const SETORAN_OWNER_CATEGORY = "Setoran Owner";
export const AR_COLLECTION_CATEGORY = "Penagihan Piutang";
export const AP_PAYMENT_CATEGORY = "Pembayaran Hutang";
export const POS_SALE_CATEGORY = "Penjualan";
export const VOID_SALE_CATEGORY = "Void Penjualan";
export const PURCHASE_DISCOUNT_CATEGORY = "Diskon Pembelian";

/** Biaya yang tidak masuk opex P&L (HPP, pembelian, retur, void, prive, setoran). */
export const PNL_OPEX_EXCLUDE_CATEGORIES = [
  "HPP",
  "Pembelian",
  PURCHASE_DISCOUNT_CATEGORY,
  POS_SALE_CATEGORY,
  "Retur Penjualan",
  VOID_SALE_CATEGORY,
  PRIVE_CATEGORY,
  SETORAN_OWNER_CATEGORY,
  TRANSFER_OUT_CATEGORY,
  TRANSFER_IN_CATEGORY,
  AR_COLLECTION_CATEGORY,
  AP_PAYMENT_CATEGORY,
] as const;

export function isPnlOpexCategory(category: string, type: "income" | "expense" | "transfer"): boolean {
  if (type !== "expense") return false;
  return !(PNL_OPEX_EXCLUDE_CATEGORIES as readonly string[]).includes(category);
}

export function cashBalanceDelta(
  type: "income" | "expense" | "transfer",
  category: string,
  amount: number,
): number {
  if (type === "expense") return -amount;
  if (type === "transfer" && category === TRANSFER_OUT_CATEGORY) return -amount;
  return amount;
}

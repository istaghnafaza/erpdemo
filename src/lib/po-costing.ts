/**
 * HPP rata-rata tertimbang + usulan harga jual saat restock beda harga.
 * Contoh: 100 sak @ 49.000 + 50 sak @ 50.000 → HPP 49.333; margin per unit dipertahankan.
 */

export function weightedAvgHpp(
  oldStock: number,
  oldHpp: number,
  inboundQty: number,
  inboundPrice: number,
): number {
  const oldQty = Math.max(0, oldStock);
  const inQty = Math.max(0, inboundQty);
  const total = oldQty + inQty;
  if (total <= 0) return Math.round(Math.max(0, inboundPrice));
  if (oldQty <= 0) return Math.round(Math.max(0, inboundPrice));
  return Math.round((oldQty * oldHpp + inQty * inboundPrice) / total);
}

/** Pertahankan margin rupiah per unit: jual baru = jual lama + (HPP baru − HPP lama). */
export function suggestedSellingPrice(
  oldSell: number,
  oldHpp: number,
  newHpp: number,
): number {
  return Math.max(0, Math.round(oldSell + (newHpp - oldHpp)));
}

export function hppDiffers(oldHpp: number, newPrice: number): boolean {
  return Math.round(oldHpp) !== Math.round(newPrice);
}

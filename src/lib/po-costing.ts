/**
 * HPP rata-rata tertimbang saat restock beda harga.
 * Contoh: 100 sak @ 49.000 + 50 sak @ 50.000 → HPP 49.333.
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

export function hppDiffers(oldHpp: number, newPrice: number): boolean {
  return Math.round(oldHpp) !== Math.round(newPrice);
}

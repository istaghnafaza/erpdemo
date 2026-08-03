// =============================================================================
// POS line pricing — breakdown untuk keranjang, review, dan struk
// =============================================================================

import type { CartItem } from "@/types/database";

export interface LinePricingDiscountRow {
  label: string;
  percent: number;
  amount: number;
}

export interface LinePricingDisplay {
  baseUnitPrice: number;
  grossLineTotal: number;
  netLineTotal: number;
  discountRows: LinePricingDiscountRow[];
  /** Diskon efektif riil (setelah cap stack & floor harga). */
  effectiveDiscountPercent: number;
  /** Harga netto dibatasi floor margin minimum. */
  clampedToFloor: boolean;
}

export function getLineBaseUnitPrice(item: CartItem): number {
  return item.base_selling_price ?? item.selling_price + (item.discount ?? 0);
}

/**
 * Rincian diskon per baris — jumlah Rp mengikuti subtotal aktual (pricing engine),
 * bukan persen × gross secara independen (yang menyesatkan saat stack cap / floor).
 */
export function getLinePricingDisplay(item: CartItem): LinePricingDisplay {
  const baseUnit = getLineBaseUnitPrice(item);
  const gross = baseUnit * item.qty;
  const net = item.subtotal;
  const tierDiscountTotal = Math.max(0, gross - net);
  const effectiveDiscountPercent =
    gross > 0 ? Math.round((tierDiscountTotal / gross) * 1000) / 10 : 0;

  const rows: LinePricingDiscountRow[] = [];
  const volPct = item.volume_discount_percent ?? 0;
  const custPct = item.customer_discount_percent ?? 0;
  const rawStack = volPct + custPct;

  if (item.price_override) {
    const overrideDisc = Math.max(0, baseUnit - item.selling_price);
    if (overrideDisc > 0) {
      rows.push({
        label: "Override harga",
        percent: baseUnit > 0 ? Math.round((overrideDisc / baseUnit) * 1000) / 10 : 0,
        amount: Math.round(overrideDisc * item.qty),
      });
    }
  } else if (tierDiscountTotal > 0) {
    if (rawStack > 0 && volPct > 0 && custPct > 0) {
      const volShare = Math.round(tierDiscountTotal * (volPct / rawStack));
      rows.push({ label: "Diskon volume", percent: volPct, amount: volShare });
      rows.push({
        label: "Diskon pelanggan",
        percent: custPct,
        amount: tierDiscountTotal - volShare,
      });
    } else if (volPct > 0) {
      rows.push({ label: "Diskon volume", percent: volPct, amount: tierDiscountTotal });
    } else if (custPct > 0) {
      rows.push({ label: "Diskon pelanggan", percent: custPct, amount: tierDiscountTotal });
    } else {
      rows.push({
        label: "Diskon",
        percent: effectiveDiscountPercent,
        amount: tierDiscountTotal,
      });
    }
  }

  return {
    baseUnitPrice: baseUnit,
    grossLineTotal: gross,
    netLineTotal: net,
    discountRows: rows.filter((r) => r.amount > 0),
    effectiveDiscountPercent,
    clampedToFloor: item.pricing_clamped === true,
  };
}

export function cartTierDiscountTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const base = getLineBaseUnitPrice(item);
    return sum + Math.max(0, base * item.qty - item.subtotal);
  }, 0);
}

export function cartGrossSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + getLineBaseUnitPrice(item) * item.qty, 0);
}

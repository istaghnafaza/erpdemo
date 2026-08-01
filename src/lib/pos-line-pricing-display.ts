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
}

export function getLineBaseUnitPrice(item: CartItem): number {
  return item.base_selling_price ?? item.selling_price + (item.discount ?? 0);
}

/** Rincian harga dasar + baris diskon tier per item keranjang. */
export function getLinePricingDisplay(item: CartItem): LinePricingDisplay {
  const baseUnit = getLineBaseUnitPrice(item);
  const gross = baseUnit * item.qty;
  const net = item.subtotal;
  const rows: LinePricingDiscountRow[] = [];

  const volPct = item.volume_discount_percent ?? 0;
  const custPct = item.customer_discount_percent ?? 0;

  if (volPct > 0) {
    rows.push({
      label: "Diskon volume",
      percent: volPct,
      amount: Math.round(gross * volPct / 100),
    });
  }
  if (custPct > 0) {
    rows.push({
      label: "Diskon pelanggan",
      percent: custPct,
      amount: Math.round(gross * custPct / 100),
    });
  }

  if (item.price_override) {
    const overrideDisc = Math.max(0, baseUnit - item.selling_price);
    if (overrideDisc > 0) {
      rows.push({
        label: "Override harga",
        percent: baseUnit > 0 ? Math.round((overrideDisc / baseUnit) * 1000) / 10 : 0,
        amount: Math.round(overrideDisc * item.qty),
      });
    }
  }

  const tierDiscountTotal = Math.max(0, gross - net);
  const rowsSum = rows.reduce((s, r) => s + r.amount, 0);

  if (tierDiscountTotal > 0 && rows.length === 0) {
    rows.push({
      label: "Diskon",
      percent: gross > 0 ? Math.round((tierDiscountTotal / gross) * 1000) / 10 : 0,
      amount: tierDiscountTotal,
    });
  } else if (tierDiscountTotal > 0 && Math.abs(rowsSum - tierDiscountTotal) > 1) {
    const diff = tierDiscountTotal - rowsSum;
    rows[rows.length - 1]!.amount += diff;
  }

  return {
    baseUnitPrice: baseUnit,
    grossLineTotal: gross,
    netLineTotal: net,
    discountRows: rows.filter((r) => r.amount > 0),
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

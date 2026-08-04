// =============================================================================
// Pricing engine — pure functions (client + server)
// =============================================================================

import type {
  LinePricingInput,
  LinePricingResult,
  PricingBundle,
  VolumePriceTier,
} from "@/types/pricing";

export function computeFloorPrice(
  purchasePrice: number,
  minMarginPercent: number,
): number {
  if (purchasePrice <= 0) return 0;
  return Math.ceil(purchasePrice * (1 + minMarginPercent / 100));
}

export function resolveMinMarginPercent(
  bundle: PricingBundle,
  categoryId?: string | null,
): number {
  if (categoryId) {
    const row = bundle.category_margins.find((m) => m.category_id === categoryId);
    if (row) return row.min_margin_percent;
  }
  return bundle.settings.default_min_margin_percent;
}

export function computeMaxDiscountPercent(
  baseSellingPrice: number,
  floorPrice: number,
): number {
  if (baseSellingPrice <= 0 || floorPrice <= 0 || baseSellingPrice <= floorPrice) return 0;
  return Math.floor(((baseSellingPrice - floorPrice) / baseSellingPrice) * 1000) / 10;
}

/** Tier volume tertinggi yang memenuhi qty per baris ATAU min belanja keranjang. */
export function pickVolumeTier(
  tiers: VolumePriceTier[],
  qty: number,
  lineBaseAmount: number,
  cartGrossSubtotal?: number,
): VolumePriceTier {
  const active = tiers
    .filter((t) => t.is_active)
    .sort((a, b) => b.sort_order - a.sort_order);

  const cartAmount = cartGrossSubtotal ?? lineBaseAmount;

  for (const tier of active) {
    const meetsQty = tier.min_qty > 0 && qty >= tier.min_qty;
    const meetsCartAmount = tier.min_line_amount > 0 && cartAmount >= tier.min_line_amount;
    if (meetsQty || meetsCartAmount) {
      return tier;
    }
  }

  const fallback =
    active.find((t) => t.tier_code === "T0") ??
    active[active.length - 1] ??
    ({
      tier_code: "T0",
      name: "Eceran",
      discount_percent: 0,
    } as VolumePriceTier);

  return fallback;
}

export function calculateLinePrice(
  input: LinePricingInput,
  bundle: PricingBundle,
): LinePricingResult {
  const base = input.base_selling_price;
  const lineBaseAmount = base * input.qty;
  const minMargin = resolveMinMarginPercent(bundle, input.category_id);
  const floorPrice = computeFloorPrice(input.purchase_price, minMargin);

  if (input.price_override_unit != null && input.price_override_unit > 0) {
    const unit = Math.max(input.price_override_unit, 0);
    const unitDiscount = Math.max(0, base - unit);
    return {
      base_selling_price: base,
      volume_tier_code: "OVERRIDE",
      volume_tier_name: "Override Manager",
      volume_discount_percent: 0,
      customer_discount_percent: 0,
      effective_discount_percent:
        base > 0 ? Math.round((unitDiscount / base) * 1000) / 10 : 0,
      unit_net_price: unit,
      unit_discount_amount: unitDiscount,
      floor_price: floorPrice,
      clamped_to_floor: unit < floorPrice,
      line_subtotal: unit * input.qty,
    };
  }

  const volumeTier = pickVolumeTier(
    bundle.volume_tiers,
    input.qty,
    lineBaseAmount,
    input.cart_gross_subtotal,
  );

  // Baris SO (indent): harga dasar — tanpa diskon tier volume maupun pelanggan
  const volumeDisc = input.is_so_line ? 0 : volumeTier.discount_percent;
  const customerDisc = input.is_so_line ? 0 : input.customer_tier_discount_percent;

  const rawTotalDisc = volumeDisc + customerDisc;
  const maxMarginDisc = computeMaxDiscountPercent(base, floorPrice);
  const cappedByPolicy = Math.min(
    rawTotalDisc,
    bundle.settings.max_stack_discount_percent,
    bundle.settings.max_line_discount_percent,
  );
  const effectiveDisc = Math.min(cappedByPolicy, maxMarginDisc);
  const marginLimited = effectiveDisc < cappedByPolicy;

  let unitNet = Math.round(base * (1 - effectiveDisc / 100));
  let clamped = false;
  if (floorPrice > 0 && unitNet < floorPrice) {
    unitNet = floorPrice;
    clamped = true;
  }

  const unitDiscount = Math.max(0, base - unitNet);

  return {
    base_selling_price: base,
    volume_tier_code: volumeTier.tier_code,
    volume_tier_name: volumeTier.name,
    volume_discount_percent: volumeDisc,
    customer_discount_percent: customerDisc,
    effective_discount_percent: effectiveDisc,
    unit_net_price: unitNet,
    unit_discount_amount: unitDiscount,
    floor_price: floorPrice,
    clamped_to_floor: clamped || marginLimited,
    margin_limited_discount: marginLimited,
    line_subtotal: unitNet * input.qty,
  };
}

export function customerTierDiscountById(
  bundle: PricingBundle,
  pricingTierId: string | null | undefined,
): number {
  if (!pricingTierId) {
    const p0 = bundle.customer_tiers.find((t) => t.tier_code === "P0" && t.is_active);
    return p0?.discount_percent ?? 0;
  }
  const tier = bundle.customer_tiers.find((t) => t.id === pricingTierId && t.is_active);
  return tier?.discount_percent ?? 0;
}

/** Hint progress ke tier volume berikutnya (per baris). */
export function nextVolumeTierHint(
  tiers: VolumePriceTier[],
  qty: number,
  baseUnitPrice: number,
): { tier: VolumePriceTier; qtyNeeded: number; amountNeeded: number } | null {
  const active = tiers.filter((t) => t.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const current = pickVolumeTier(active, qty, baseUnitPrice * qty, baseUnitPrice * qty);
  const currentOrder = current.sort_order ?? 0;
  const next = active.find((t) => t.sort_order > currentOrder);
  if (!next) return null;

  const qtyNeeded = Math.max(0, next.min_qty - qty);
  const lineAmount = baseUnitPrice * qty;
  const amountNeeded = Math.max(0, next.min_line_amount - lineAmount);

  return { tier: next, qtyNeeded, amountNeeded };
}

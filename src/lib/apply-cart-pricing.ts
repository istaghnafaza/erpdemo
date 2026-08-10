// =============================================================================
// Apply pricing bundle to cart lines
// =============================================================================

import { calculateLinePrice, customerTierDiscountById } from "@/lib/pricing-engine";
import type { CartItem, Customer } from "@/types/database";
import type { PricingBundle } from "@/types/pricing";

export function cartGrossSubtotalForPricing(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    if (item.is_so_line) return sum;
    const base = item.base_selling_price ?? item.selling_price + (item.discount ?? 0);
    return sum + base * item.qty;
  }, 0);
}

export function applyPricingToCartItem(
  item: CartItem,
  customer: Customer | null,
  bundle: PricingBundle,
  cartGrossSubtotal?: number,
): CartItem {
  const base =
    item.base_selling_price ?? item.selling_price + (item.discount ?? 0);
  const customerDisc = customerTierDiscountById(bundle, customer?.pricing_tier_id);

  const result = calculateLinePrice(
    {
      base_selling_price: base,
      purchase_price: item.purchase_price,
      qty: item.qty,
      category_id: item.category_id,
      customer_tier_discount_percent: customerDisc,
      is_so_line: item.is_so_line,
      price_override_unit: item.price_override?.unit_price ?? null,
      cart_gross_subtotal: cartGrossSubtotal,
    },
    bundle,
  );

  return {
    ...item,
    base_selling_price: base,
    selling_price: result.unit_net_price,
    discount: result.unit_discount_amount,
    subtotal: result.line_subtotal,
    volume_tier_code: result.volume_tier_code,
    volume_discount_percent: result.volume_discount_percent,
    customer_discount_percent: result.customer_discount_percent,
    floor_price: result.floor_price,
    pricing_clamped: result.clamped_to_floor,
    pricing_margin_limited: result.margin_limited_discount === true,
  };
}

export function repriceCartItems(
  items: CartItem[],
  customer: Customer | null,
  bundle: PricingBundle,
): CartItem[] {
  const cartGross = cartGrossSubtotalForPricing(items);
  return items.map((item) => {
    // Harga satuan jual (multi-unit) dikunci — jangan diubah engine volume/tier
    if (item.price_override?.unit_price != null && item.sell_unit_id) {
      const unit = item.price_override.unit_price;
      return {
        ...item,
        base_selling_price: unit,
        selling_price: unit,
        discount: 0,
        subtotal: unit * item.qty,
        volume_tier_code: null,
        volume_discount_percent: 0,
        customer_discount_percent: 0,
        pricing_clamped: false,
        pricing_margin_limited: false,
      };
    }
    return applyPricingToCartItem(item, customer, bundle, cartGross);
  });
}

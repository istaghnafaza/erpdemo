// =============================================================================
// POS → Sales Order — satu struk, sebagian baris fulfillment via SO/indent.
// =============================================================================

import type { CartItem } from "@/types/database";
import type { CreateSoItemDraft } from "@/stores/sales-orders.store";

export function isCartSoLine(item: CartItem): boolean {
  return item.is_so_line === true;
}

export function cartSoLines(items: CartItem[]): CartItem[] {
  return items.filter(isCartSoLine);
}

export function cartStockLines(items: CartItem[]): CartItem[] {
  return items.filter((i) => !isCartSoLine(i));
}

export function hasCartSoLines(items: CartItem[]): boolean {
  return items.some(isCartSoLine);
}

export function allocateCartDiscountToSoLines(
  items: CartItem[],
  cartDiscountAmount: number,
): { soSubtotal: number; soDiscountAmount: number; soGrandTotal: number } {
  const soItems = cartSoLines(items);
  const totalSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const soSubtotal = soItems.reduce((s, i) => s + i.subtotal, 0);
  if (soSubtotal <= 0) {
    return { soSubtotal: 0, soDiscountAmount: 0, soGrandTotal: 0 };
  }
  const soDiscountAmount =
    totalSubtotal > 0 ? Math.round(cartDiscountAmount * (soSubtotal / totalSubtotal)) : 0;
  return {
    soSubtotal,
    soDiscountAmount,
    soGrandTotal: Math.max(0, soSubtotal - soDiscountAmount),
  };
}

export function cartItemsToSoDrafts(items: CartItem[]): CreateSoItemDraft[] {
  return cartSoLines(items).map((i) => ({
    product_id: i.product_id,
    product_name: i.name,
    sku: i.sku,
    unit: i.unit,
    qty: i.qty,
    selling_price: i.selling_price,
    discount: i.discount,
  }));
}

/** Alokasi DP checkout POS ke nilai SO (proporsional). */
export function allocateDownPaymentToSo(
  cartGrandTotal: number,
  amountPaid: number,
  soGrandTotal: number,
  paymentMethod: string,
): number {
  if (soGrandTotal <= 0) return 0;
  if (paymentMethod === "credit") {
    if (cartGrandTotal <= 0 || amountPaid <= 0) return 0;
    return Math.min(soGrandTotal, Math.round(amountPaid * (soGrandTotal / cartGrandTotal)));
  }
  return soGrandTotal;
}

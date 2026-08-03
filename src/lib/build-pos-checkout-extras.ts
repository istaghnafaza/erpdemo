// =============================================================================
// Build POS checkout extras for Neon atomic side-effects
// =============================================================================

import {
  allocateCartDiscountToSoLines,
  allocateDownPaymentToSo,
  cartItemsToSoDrafts,
  hasCartSoLines,
  isCartSoLine,
} from "@/lib/pos-so-checkout";
import { orderRequiresPhysicalDelivery } from "@/lib/sales-transaction-utils";
import type {
  BuildPosCheckoutExtrasInput,
  PosCheckoutExtras,
} from "@/types/pos-checkout-extras";

export function buildPosCheckoutExtras(input: BuildPosCheckoutExtrasInput): PosCheckoutExtras {
  const {
    cart,
    paymentMethod,
    discountAmount,
    grandTotal,
    amountPaid,
    transactionNumber,
    cashierId,
  } = input;

  const extras: PosCheckoutExtras = {};
  const deliveryAddress = cart.deliveryAddress?.trim() || null;

  const shippableEntries = cart.items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => !isCartSoLine(item));

  if (
    orderRequiresPhysicalDelivery(cart.orderFulfillmentType) &&
    shippableEntries.length > 0 &&
    deliveryAddress
  ) {
    extras.delivery = {
      orderFulfillmentType: cart.orderFulfillmentType,
      customerName: cart.customer?.name ?? null,
      customerPhone: cart.customer?.phone ?? null,
      deliveryAddress,
      grandTotal,
    };
  }

  if (hasCartSoLines(cart.items)) {
    const { soDiscountAmount, soGrandTotal } = allocateCartDiscountToSoLines(
      cart.items as Parameters<typeof allocateCartDiscountToSoLines>[0],
      discountAmount,
    );
    const soDownPayment = allocateDownPaymentToSo(
      grandTotal,
      amountPaid,
      soGrandTotal,
      paymentMethod,
    );

    extras.salesOrder = {
      customer_id: cart.customer?.id ?? null,
      customer_name: cart.customer?.name ?? "Pelanggan Umum",
      delivery_address: deliveryAddress,
      discount_amount: soDiscountAmount,
      down_payment: soDownPayment,
      created_by: cashierId,
      pos_transaction_number: transactionNumber,
      items: cartItemsToSoDrafts(
        cart.items as Parameters<typeof cartItemsToSoDrafts>[0],
      ),
    };
  }

  if (cart.returnOffset?.returnId && cart.returnOffset.amount > 0) {
    extras.returnOffset = {
      returnId: cart.returnOffset.returnId,
      offsetAmount: cart.returnOffset.amount,
    };
  }

  return extras;
}

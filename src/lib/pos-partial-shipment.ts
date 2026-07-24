// =============================================================================
// POS partial shipment — validation & helpers for "Di Kirim Sebagian".
// =============================================================================

import type { CartItem } from "@/types/database";
import { isCartSoLine } from "@/lib/pos-so-checkout";

export interface PartialShipLine {
  selected: boolean;
  shipQty: number;
}

export function emptyPartialShipLine(): PartialShipLine {
  return { selected: false, shipQty: 0 };
}

export function syncPartialShipLines(
  items: CartItem[],
  partialShip: PartialShipLine[],
): PartialShipLine[] {
  const next = partialShip.slice(0, items.length);
  while (next.length < items.length) {
    next.push(emptyPartialShipLine());
  }
  return next.map((line, i) => {
    const item = items[i];
    if (item && isCartSoLine(item)) {
      return { selected: false, shipQty: 0 };
    }
    const max = item?.qty ?? 0;
    if (!line.selected) return { selected: false, shipQty: 0 };
    const shipQty = Math.min(max, Math.max(1, line.shipQty));
    return { selected: true, shipQty };
  });
}

export function validatePartialShipment(
  items: CartItem[],
  partialShip: PartialShipLine[],
): { ok: true } | { ok: false; error: string } {
  if (items.length === 0) {
    return { ok: false, error: "Keranjang kosong" };
  }
  if (partialShip.length !== items.length) {
    return { ok: false, error: "Data kirim sebagian belum sinkron — ubah kembali tipe order" };
  }

  let selectedCount = 0;
  let shippableCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (isCartSoLine(item)) continue;
    shippableCount += 1;

    const line = partialShip[i];
    if (!line.selected) continue;

    if (line.shipQty < 1) {
      return { ok: false, error: `Qty kirim "${item.name}" minimal 1` };
    }
    if (line.shipQty > item.qty) {
      return {
        ok: false,
        error: `Qty kirim "${item.name}" melebihi qty order (${item.qty} ${item.unit})`,
      };
    }
    selectedCount += 1;
  }

  if (shippableCount === 0) {
    return { ok: true };
  }

  if (selectedCount === 0) {
    return { ok: false, error: "Centang minimal satu barang stok yang akan dikirim" };
  }

  const allSelectedFull = items.every(
    (item, i) =>
      isCartSoLine(item) ||
      (partialShip[i].selected && partialShip[i].shipQty === item.qty),
  );
  if (allSelectedFull && shippableCount > 0) {
    return {
      ok: false,
      error: 'Semua barang dikirim penuh — gunakan keterangan order "Di Kirim"',
    };
  }

  return { ok: true };
}

// =============================================================================
// Format pesan WA order ke supplier (PO Indent dari SO)
// =============================================================================

export interface IndentWaOrderLine {
  productName: string;
  sku: string;
  qty: number;
  unit: string;
}

export interface IndentWaOrderPayload {
  customerName: string;
  deliveryAddress?: string | null;
  lines: IndentWaOrderLine[];
  notes?: string | null;
}

/** Normalisasi nomor telepon ke format wa.me (62xxx). */
export function normalizeWhatsAppPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.length >= 9) return `62${digits}`;
  return null;
}

export function formatWaCatatan(notes: string | null | undefined): string | null {
  if (!notes?.trim()) return null;
  const posMatch = notes.match(/checkout POS\s+(\S+)/i);
  if (posMatch) return `Dibuat otomatis dari checkout POS ${posMatch[1]}`;
  return notes.trim();
}

export function formatIndentSupplierOrderMessage(payload: IndentWaOrderPayload): string {
  const itemLines = payload.lines
    .map((l) => `• ${l.productName}\n  Qty: ${l.qty} ${l.unit}`)
    .join("\n");

  const addrLine = payload.deliveryAddress?.trim()
    ? `Kirim ke   : ${payload.deliveryAddress.trim()}\n`
    : "";

  const catatan = formatWaCatatan(payload.notes);
  const catatanBlock = catatan ? `\n\nCatatan:\n${catatan}` : "";

  return (
    `📢 *Detail Order*\n\n` +
    `*Pengiriman langsung ke pelanggan:*\n` +
    `Pelanggan  : ${payload.customerName}\n` +
    addrLine +
    `\n*Item :*\n` +
    `${itemLines}\n\n` +
    `Mohon konfirmasi ketersediaan & estimasi kirim.\n` +
    `Terima kasih.` +
    catatanBlock
  );
}

/** Buka chat WA dengan pesan order (prefill). */
export function openSupplierWhatsAppOrder(phone: string | null | undefined, message: string): boolean {
  const normalized = phone ? normalizeWhatsAppPhone(phone) : null;
  if (!normalized) return false;
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

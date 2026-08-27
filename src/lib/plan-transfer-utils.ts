// =============================================================================
// Plan bank transfer — unique amount & payment reference helpers
// =============================================================================

/** Suffix 100–999 agar nominal transfer unik per invoice. */
export function makeUniquePayAmount(baseAmount: number, orderId: string): number {
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    hash = (Math.imul(31, hash) + orderId.charCodeAt(i)) | 0;
  }
  const suffix = (Math.abs(hash) % 900) + 100;
  return baseAmount + suffix;
}

/** Kode berita transfer singkat dari order id. */
export function makePaymentReference(orderId: string): string {
  const parts = orderId.split("-").filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[0]}-${parts[1]}-${parts[2]}`.toUpperCase();
  }
  return orderId.slice(0, 24).toUpperCase();
}

export function normalizeTransferText(text: string): string {
  return text.toUpperCase().replace(/\s+/g, " ").trim();
}

export function referenceInText(reference: string, text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const norm = normalizeTransferText(text);
  const ref = normalizeTransferText(reference);
  return norm.includes(ref) || norm.replace(/-/g, "").includes(ref.replace(/-/g, ""));
}

export function parseIdrAmount(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

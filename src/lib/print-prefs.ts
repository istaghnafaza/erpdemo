// =============================================================================
// Print preferences — thermal width + invoice paper (per tenant/branch, local)
// =============================================================================

export type ReceiptWidthPreset = "58" | "80" | "custom";
export type InvoicePaperSize = "a4" | "a5";

export interface PrintPrefs {
  receiptPreset: ReceiptWidthPreset;
  customMm: number;
  invoicePaper: InvoicePaperSize;
  /** Origin yang bisa dibuka iPhone (LAN IP saat uji local). Kosong = origin tab ini. */
  thermerOrigin: string;
}

export const DEFAULT_PRINT_PREFS: PrintPrefs = {
  receiptPreset: "58",
  customMm: 72,
  invoicePaper: "a4",
  thermerOrigin: "",
};

const MIN_RECEIPT_MM = 40;
const MAX_RECEIPT_MM = 120;

export function clampReceiptMm(n: number): number {
  if (!Number.isFinite(n)) return 58;
  return Math.min(MAX_RECEIPT_MM, Math.max(MIN_RECEIPT_MM, Math.round(n)));
}

export function receiptWidthMm(prefs: PrintPrefs): number {
  if (prefs.receiptPreset === "80") return 80;
  if (prefs.receiptPreset === "custom") return clampReceiptMm(prefs.customMm);
  return 58;
}

function storageKey(scopeKey: string): string {
  return `seps.print-prefs:${scopeKey}`;
}

export function loadPrintPrefs(scopeKey: string): PrintPrefs {
  if (typeof window === "undefined") return DEFAULT_PRINT_PREFS;
  try {
    const raw = localStorage.getItem(storageKey(scopeKey));
    if (!raw) return DEFAULT_PRINT_PREFS;
    const parsed = JSON.parse(raw) as Partial<PrintPrefs>;
    return {
      receiptPreset:
        parsed.receiptPreset === "80" || parsed.receiptPreset === "custom" ? parsed.receiptPreset : "58",
      customMm: clampReceiptMm(parsed.customMm ?? DEFAULT_PRINT_PREFS.customMm),
      invoicePaper: parsed.invoicePaper === "a5" ? "a5" : "a4",
      thermerOrigin: typeof parsed.thermerOrigin === "string" ? parsed.thermerOrigin : "",
    };
  } catch {
    return DEFAULT_PRINT_PREFS;
  }
}

export function savePrintPrefs(scopeKey: string, prefs: PrintPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(scopeKey), JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

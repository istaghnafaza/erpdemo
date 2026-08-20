// =============================================================================
// Thermer / Bluetooth Print (iOS) — PrintEntry JSON
// =============================================================================

import type { ReceiptData } from "@/lib/build-receipt-data";
import { rupiah, tanggal } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/sales-transaction-utils";

/** Matches Thermer / Bluetooth Print sample (type 0–3). */
export interface ThermerPrintEntry {
  type: 0 | 1 | 2 | 3;
  content?: string;
  bold?: 0 | 1;
  align?: 0 | 1 | 2;
  format?: 0 | 1 | 2 | 3 | 4;
  path?: string;
  value?: string;
  height?: number;
  size?: number;
}

const DASH = "--------------------------------";

function text(
  content: string,
  opts: { bold?: 0 | 1; align?: 0 | 1 | 2; format?: 0 | 1 | 2 | 3 | 4 } = {},
): ThermerPrintEntry {
  return {
    type: 0,
    content,
    bold: opts.bold ?? 0,
    align: opts.align ?? 0,
    format: opts.format ?? 0,
  };
}

function blank(): ThermerPrintEntry {
  return text(" ", { bold: 0, align: 0, format: 0 });
}

export function receiptToThermerEntries(
  receipt: ReceiptData,
  opts: { includeQr?: boolean } = {},
): ThermerPrintEntry[] {
  const entries: ThermerPrintEntry[] = [];
  entries.push(text(receipt.storeName || receipt.branchName, { bold: 1, align: 1, format: 3 }));
  if (receipt.branchName && receipt.branchName !== receipt.storeName) {
    entries.push(text(receipt.branchName, { align: 1, format: 4 }));
  }
  if (receipt.branchAddress) {
    entries.push(text(receipt.branchAddress, { align: 1, format: 4 }));
  }
  if (receipt.branchPhone) {
    entries.push(text(`WA: ${receipt.branchPhone}`, { align: 1, format: 4 }));
  }
  entries.push(text(DASH, { align: 1, format: 4 }));
  entries.push(text(receipt.transactionNumber, { bold: 1, align: 1, format: 0 }));
  entries.push(text(tanggal(receipt.createdAt, { withTime: true }), { align: 1, format: 4 }));
  entries.push(text(`Kasir: ${receipt.cashierName}`, { format: 4 }));
  if (receipt.customerName) {
    entries.push(text(`Pelanggan: ${receipt.customerName}`, { format: 4 }));
  }
  entries.push(text(DASH, { align: 1, format: 4 }));

  for (const item of receipt.items) {
    entries.push(text(item.name, { format: 0 }));
    const qty = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(item.qty);
    entries.push(
      text(`${qty} ${item.unit} x ${rupiah(item.selling_price)}`, { format: 4 }),
    );
    entries.push(text(rupiah(item.subtotal), { align: 2, format: 0 }));
  }

  entries.push(text(DASH, { align: 1, format: 4 }));
  entries.push(text(`Subtotal  ${rupiah(receipt.subtotal)}`, { align: 2, format: 4 }));
  if (receipt.discountAmount > 0) {
    entries.push(text(`Diskon  -${rupiah(receipt.discountAmount)}`, { align: 2, format: 4 }));
  }
  if ((receipt.returnOffsetAmount ?? 0) > 0) {
    entries.push(text(`Potong retur  -${rupiah(receipt.returnOffsetAmount!)}`, { align: 2, format: 4 }));
  }
  entries.push(text(`TOTAL  ${rupiah(receipt.grandTotal)}`, { bold: 1, align: 2, format: 1 }));
  entries.push(
    text(
      `Bayar (${paymentMethodLabel(receipt.paymentMethod)})  ${rupiah(receipt.amountPaid)}`,
      { align: 2, format: 4 },
    ),
  );
  if (receipt.change > 0) {
    entries.push(text(`Kembali  ${rupiah(receipt.change)}`, { align: 2, format: 4 }));
  }
  if (receipt.paymentMethod === "credit" && receipt.amountPaid < receipt.grandTotal) {
    entries.push(
      text(`Sisa piutang  ${rupiah(receipt.grandTotal - receipt.amountPaid)}`, {
        bold: 1,
        align: 2,
        format: 0,
      }),
    );
  }
  entries.push(blank());
  entries.push(text("Terima kasih", { align: 1, format: 0 }));
  if (opts.includeQr) {
    entries.push({
      type: 3,
      value: receipt.transactionNumber,
      size: 40,
      align: 1,
    });
  }
  return entries;
}

export function sampleThermerEntries(): ThermerPrintEntry[] {
  return receiptToThermerEntries({
    transactionNumber: "TRX-UJI-THERMER",
    items: [
      {
        product_id: "sample",
        name: "Semen 50 kg (uji cetak)",
        qty: 2,
        unit: "sak",
        selling_price: 75000,
        discount: 0,
        subtotal: 150000,
      },
    ],
    subtotal: 150000,
    discountAmount: 0,
    grandTotal: 150000,
    paymentMethod: "cash",
    amountPaid: 200000,
    change: 50000,
    isOffline: false,
    orderFulfillmentType: "cod",
    cashierName: "Kasir Uji",
    customerName: "Pelanggan Uji",
    deliverySiteLabel: null,
    deliveryAddress: null,
    branchName: "Cabang Uji",
    branchAddress: "Jl. Uji Thermal 58/80 mm",
    branchPhone: "08123456789",
    storeName: "SEPS",
    createdAt: new Date().toISOString(),
  });
}

/** PHP JSON_FORCE_OBJECT — indexed object the iOS app expects. */
export function thermerEntriesAsForceObject(
  entries: ThermerPrintEntry[],
): Record<string, ThermerPrintEntry> {
  const out: Record<string, ThermerPrintEntry> = {};
  entries.forEach((entry, i) => {
    out[String(i)] = entry;
  });
  return out;
}

export function sanitizePublicOrigin(raw: string, fallback: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return fallback.replace(/\/$/, "");
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback.replace(/\/$/, "");
    return `${url.protocol}//${url.host}`;
  } catch {
    return fallback.replace(/\/$/, "");
  }
}

export function thermerJsonUrl(origin: string, jobId: string): string {
  return `${origin.replace(/\/$/, "")}/api/print/thermer?job=${encodeURIComponent(jobId)}`;
}

export function thermerSampleJsonUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/print/thermer?sample=1`;
}

export function bprintHref(jsonUrl: string): string {
  return `bprint://${jsonUrl}`;
}

const THERMER_ANDROID_PACKAGE = "mate.bluetoothprint";

/** Thermer Android dari website: ACTION_SEND text, bukan thermer:// (itu iOS). */
export function entriesToThermerShareText(entries: ThermerPrintEntry[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.type !== 0) continue;
    const bold = entry.bold ?? 0;
    const align = entry.align ?? 0;
    const format = entry.format ?? 0;
    lines.push(`<${bold}${align}${format}>${entry.content ?? ""}`);
  }
  lines.push("<020> ");
  return lines.join("\n");
}

export function androidThermerSendIntentHref(shareText: string, opts?: { chooser?: boolean }): string {
  const extra = encodeURIComponent(shareText);
  const pkg = opts?.chooser ? "" : `package=${THERMER_ANDROID_PACKAGE};`;
  return `intent:#Intent;action=android.intent.action.SEND;type=text/plain;${pkg}S.android.intent.extra.TEXT=${extra};end;`;
}

export function openCustomSchemeHref(href: string): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.rel = "noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** Inline payload — iPad often stuck if app harus fetch JSON lalu pilih printer. */
export function thermerInlineHref(entries: ThermerPrintEntry[]): string {
  const json = JSON.stringify(thermerEntriesAsForceObject(entries));
  const encoded = encodeURIComponent(json);
  return `thermer://print?data=${encoded}`;
}

export function receiptToPlainText(receipt: ReceiptData): string {
  const lines: string[] = [];
  lines.push(receipt.storeName || receipt.branchName);
  if (receipt.branchName && receipt.branchName !== receipt.storeName) lines.push(receipt.branchName);
  if (receipt.branchAddress) lines.push(receipt.branchAddress);
  if (receipt.branchPhone) lines.push(`WA: ${receipt.branchPhone}`);
  lines.push(DASH);
  lines.push(receipt.transactionNumber);
  lines.push(tanggal(receipt.createdAt, { withTime: true }));
  lines.push(`Kasir: ${receipt.cashierName}`);
  if (receipt.customerName) lines.push(`Pelanggan: ${receipt.customerName}`);
  lines.push(DASH);
  for (const item of receipt.items) {
    const qty = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(item.qty);
    lines.push(item.name);
    lines.push(`${qty} ${item.unit} x ${rupiah(item.selling_price)}`);
    lines.push(rupiah(item.subtotal));
  }
  lines.push(DASH);
  lines.push(`Subtotal  ${rupiah(receipt.subtotal)}`);
  if (receipt.discountAmount > 0) lines.push(`Diskon  -${rupiah(receipt.discountAmount)}`);
  if ((receipt.returnOffsetAmount ?? 0) > 0) {
    lines.push(`Potong retur  -${rupiah(receipt.returnOffsetAmount!)}`);
  }
  lines.push(`TOTAL  ${rupiah(receipt.grandTotal)}`);
  lines.push(`Bayar (${paymentMethodLabel(receipt.paymentMethod)})  ${rupiah(receipt.amountPaid)}`);
  if (receipt.change > 0) lines.push(`Kembali  ${rupiah(receipt.change)}`);
  if (receipt.paymentMethod === "credit" && receipt.amountPaid < receipt.grandTotal) {
    lines.push(`Sisa piutang  ${rupiah(receipt.grandTotal - receipt.amountPaid)}`);
  }
  lines.push("");
  lines.push("Terima kasih");
  lines.push("");
  return lines.join("\n");
}

export function rawbtHref(plainText: string): string {
  const encoded = encodeURIComponent(plainText);
  return `intent:${encoded}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
}

export function detectMobilePrintPlatform(): "android" | "ios" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  const iPadOs =
    /iPad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (/iPhone|iPod/i.test(ua) || iPadOs) return "ios";
  return "other";
}

export function isThermerPrintEntry(value: unknown): value is ThermerPrintEntry {
  if (!value || typeof value !== "object") return false;
  const type = (value as ThermerPrintEntry).type;
  return type === 0 || type === 1 || type === 2 || type === 3;
}

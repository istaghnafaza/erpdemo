// =============================================================================
// Browser print — isolate document + inject @page size
// =============================================================================

export type PrintKind = "receipt" | "handover" | "invoice";

export interface PrintPageOptions {
  receiptWidthMm?: number;
  invoicePaper?: "a4" | "a5";
}

const STYLE_ID = "seps-dynamic-print-page";

function ensureStyleEl(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  return el;
}

export function applyPrintPageStyle(kind: PrintKind, opts: PrintPageOptions = {}): void {
  const el = ensureStyleEl();
  if (kind === "receipt") {
    const mm = opts.receiptWidthMm ?? 58;
    document.documentElement.style.setProperty("--print-receipt-width", `${mm}mm`);
    el.textContent = `@media print { @page { size: ${mm}mm auto; margin: 2mm; } }`;
    return;
  }
  if (kind === "invoice") {
    const a5 = opts.invoicePaper === "a5";
    el.textContent = `@media print { @page { size: ${a5 ? "A5" : "A4"} portrait; margin: ${a5 ? "10mm" : "12mm"}; } }`;
    return;
  }
  el.textContent = `@media print { @page { size: A4 portrait; margin: 12mm; } }`;
}

export function printByKind(kind: PrintKind, opts: PrintPageOptions = {}): void {
  applyPrintPageStyle(kind, opts);
  document.body.dataset.print = kind;
  const cleanup = () => {
    delete document.body.dataset.print;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  window.setTimeout(cleanup, 1500);
}

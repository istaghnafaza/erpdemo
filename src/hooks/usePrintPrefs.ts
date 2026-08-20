import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadPrintPrefs,
  receiptWidthMm,
  savePrintPrefs,
  type InvoicePaperSize,
  type PrintPrefs,
  type ReceiptWidthPreset,
} from "@/lib/print-prefs";

export function printPrefsScope(tenantId: string, branchId: string | null | undefined): string {
  return `${tenantId || "tenant"}:${branchId || "default"}`;
}

export function usePrintPrefs(scopeKey: string) {
  const [prefs, setPrefsState] = useState<PrintPrefs>(() => loadPrintPrefs(scopeKey));

  useEffect(() => {
    setPrefsState(loadPrintPrefs(scopeKey));
  }, [scopeKey]);

  const setPrefs = useCallback(
    (next: PrintPrefs | ((prev: PrintPrefs) => PrintPrefs)) => {
      setPrefsState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        savePrintPrefs(scopeKey, resolved);
        return resolved;
      });
    },
    [scopeKey],
  );

  const widthMm = useMemo(() => receiptWidthMm(prefs), [prefs]);

  const setReceiptPreset = useCallback(
    (receiptPreset: ReceiptWidthPreset) => setPrefs((p) => ({ ...p, receiptPreset })),
    [setPrefs],
  );

  const setCustomMm = useCallback(
    (customMm: number) => setPrefs((p) => ({ ...p, customMm })),
    [setPrefs],
  );

  const setInvoicePaper = useCallback(
    (invoicePaper: InvoicePaperSize) => setPrefs((p) => ({ ...p, invoicePaper })),
    [setPrefs],
  );

  const setThermerOrigin = useCallback(
    (thermerOrigin: string) => setPrefs((p) => ({ ...p, thermerOrigin })),
    [setPrefs],
  );

  return {
    prefs,
    setPrefs,
    widthMm,
    setReceiptPreset,
    setCustomMm,
    setInvoicePaper,
    setThermerOrigin,
  };
}

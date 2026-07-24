// =============================================================================
// Receivables calculations — ringkasan piutang untuk dashboard keuangan.
// =============================================================================

import { daysBetween } from "@/lib/format";
import type { ArPaymentRecord, Receivable } from "@/lib/mock-data";

export interface ReceivablesSummary {
  totalOutstanding: number;
  newThisMonth: number;
  collectedThisMonth: number;
  overdue: number;
  activeInvoiceCount: number;
}

function inPeriod(iso: string, from?: string, to?: string): boolean {
  const d = iso.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function remaining(receivable: Receivable): number {
  return Math.max(0, receivable.amount - receivable.paid);
}

export function computeReceivablesSummary(
  receivables: Receivable[],
  payments: ArPaymentRecord[],
  branchIds: string[],
  monthRange?: { from: string; to: string },
): ReceivablesSummary {
  const scope = branchIds.length > 0 ? branchIds : null;
  const scopedReceivables = scope
    ? receivables.filter((r) => scope.includes(r.branchId))
    : receivables;
  const scopedPayments = scope
    ? payments.filter((p) => scope.includes(p.branchId))
    : payments;

  const today = new Date().toISOString();
  let totalOutstanding = 0;
  let newThisMonth = 0;
  let overdue = 0;
  let activeInvoiceCount = 0;

  for (const r of scopedReceivables) {
    const rem = remaining(r);
    if (rem <= 0) continue;

    activeInvoiceCount += 1;
    totalOutstanding += rem;

    if (monthRange && inPeriod(r.issuedDate, monthRange.from, monthRange.to)) {
      newThisMonth += r.amount;
    }

    if (daysBetween(today, r.dueDate) > 0) {
      overdue += rem;
    }
  }

  let collectedThisMonth = 0;
  if (monthRange) {
    for (const p of scopedPayments) {
      if (inPeriod(p.paymentDate, monthRange.from, monthRange.to)) {
        collectedThisMonth += p.amount;
      }
    }
  }

  return {
    totalOutstanding,
    newThisMonth,
    collectedThisMonth,
    overdue,
    activeInvoiceCount,
  };
}

// =============================================================================
// AR/AP utilities — aging buckets & status labels (Fase 12).
// =============================================================================

import { daysBetween } from "@/lib/format";

export type ArApStatus = "paid" | "partial" | "unpaid" | "overdue";

export type AgingBucket = "current" | "0-30" | "31-60" | "61-90" | "90+";

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Belum Jatuh Tempo",
  "0-30": "Terlambat 0–30 hari",
  "31-60": "Terlambat 31–60 hari",
  "61-90": "Terlambat 61–90 hari",
  "90+": "Terlambat >90 hari",
};

export const AR_AP_STATUS_LABELS: Record<ArApStatus, string> = {
  paid: "Lunas",
  partial: "Sebagian",
  unpaid: "Belum",
  overdue: "Terlambat",
};

export function remainingAmount(amount: number, paid: number): number {
  return Math.max(0, amount - paid);
}

export function getArApStatus(
  amount: number,
  paid: number,
  dueDate: string,
  todayIso = new Date().toISOString(),
): ArApStatus {
  if (remainingAmount(amount, paid) <= 0) return "paid";
  if (daysBetween(todayIso, dueDate) > 0) return "overdue";
  if (paid > 0) return "partial";
  return "unpaid";
}

export function getAgingBucket(
  dueDate: string,
  amount: number,
  paid: number,
  todayIso = new Date().toISOString(),
): AgingBucket {
  const rem = remainingAmount(amount, paid);
  if (rem <= 0) return "current";

  const daysOverdue = daysBetween(todayIso, dueDate);
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

export interface AgingLineItem {
  amount: number;
  dueDate: string;
  paid: number;
}

export function computeAgingBuckets(items: AgingLineItem[]): Record<AgingBucket, number> {
  const buckets: Record<AgingBucket, number> = {
    current: 0,
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };

  for (const item of items) {
    const rem = remainingAmount(item.amount, item.paid);
    if (rem <= 0) continue;
    buckets[getAgingBucket(item.dueDate, item.amount, item.paid)] += rem;
  }

  return buckets;
}

export function filterByBranchIds<T extends { branchId: string }>(
  items: T[],
  branchIds: string[],
): T[] {
  if (branchIds.length === 0) return [];
  return items.filter((item) => branchIds.includes(item.branchId));
}

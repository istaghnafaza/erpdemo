// =============================================================================
// Jendela retur — H+1 sampai 23:59 kalender
// =============================================================================

/** Deadline = 23:59:59.999 pada (tanggal transaksi + windowDays). */
export function getRefundWindowDeadline(
  transactionCreatedAt: string | Date,
  windowDays = 1,
): Date {
  const tx = new Date(transactionCreatedAt);
  const deadline = new Date(tx);
  deadline.setHours(0, 0, 0, 0);
  deadline.setDate(deadline.getDate() + windowDays);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

export function isWithinRefundWindow(
  transactionCreatedAt: string | Date,
  now: Date = new Date(),
  windowDays = 1,
): boolean {
  return now.getTime() <= getRefundWindowDeadline(transactionCreatedAt, windowDays).getTime();
}

export function formatRefundDeadline(transactionCreatedAt: string | Date, windowDays = 1): string {
  return getRefundWindowDeadline(transactionCreatedAt, windowDays).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

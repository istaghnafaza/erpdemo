// =============================================================================
// Zona waktu operasional — Indonesia (WIB), selaras histori & dashboard.
// =============================================================================

export const APP_TIMEZONE = "Asia/Jakarta";

/** Tanggal kalender YYYY-MM-DD di zona WIB. */
export function dateKeyInAppTz(isoOrDate: Date | string = new Date()): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(d);
}

export function todayKeyInAppTz(): string {
  return dateKeyInAppTz(new Date());
}

/** Rentang UTC untuk satu hari kalender WIB (untuk filter DB timestamptz). */
export function utcRangeForAppDateKey(dateKey: string): { from: Date; to: Date } {
  return {
    from: new Date(`${dateKey}T00:00:00+07:00`),
    to: new Date(`${dateKey}T23:59:59.999+07:00`),
  };
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const { from } = utcRangeForAppDateKey(dateKey);
  from.setUTCDate(from.getUTCDate() + deltaDays);
  return dateKeyInAppTz(from);
}

export function monthStartKeyFromDateKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

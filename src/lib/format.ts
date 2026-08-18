export const rupiah = (n: number, opts: { compact?: boolean } = {}) => {
  if (opts.compact) {
    if (Math.abs(n) >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
    if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`;
    if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`;
  }
  return `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;
};

export const angka = (n: number) => new Intl.NumberFormat("id-ID").format(n);

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_ID_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Zona toko — SSR Node (UTC) dan browser (WIB) harus menghasilkan jam/tanggal yang sama. */
export const APP_TIME_ZONE = "Asia/Jakarta";

export function datePartsInAppTz(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour"),
    minute: num("minute"),
  };
}

export function greetingWord(date: Date = new Date()): string {
  const h = datePartsInAppTz(date).hour;
  if (h < 11) return "Pagi";
  if (h < 15) return "Siang";
  if (h < 19) return "Sore";
  return "Malam";
}

export function tanggalHariIni(opts: { full?: boolean } = {}): string {
  const p = datePartsInAppTz();
  const month = (opts.full ? MONTHS_ID_FULL : MONTHS_ID)[p.month - 1];
  return `${p.day} ${month} ${p.year}`;
}

/** Compact number without Intl notation (Node vs Chrome can disagree). */
export function compactAngka(n: number): string {
  const v = Math.round(n);
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} M`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} jt`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)} rb`;
  return String(v);
}

export const tanggal = (iso: string, opts: { full?: boolean; withTime?: boolean } = {}) => {
  const d = new Date(iso);
  const p = datePartsInAppTz(d);
  const month = (opts.full ? MONTHS_ID_FULL : MONTHS_ID)[p.month - 1];
  const base = `${p.day} ${month} ${p.year}`;
  if (opts.withTime) {
    const hh = String(p.hour).padStart(2, "0");
    const mm = String(p.minute).padStart(2, "0");
    return `${base}, ${hh}:${mm}`;
  }
  return base;
};

export const daysBetween = (isoA: string, isoB: string) => {
  const a = new Date(isoA).setHours(0, 0, 0, 0);
  const b = new Date(isoB).setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86_400_000);
};

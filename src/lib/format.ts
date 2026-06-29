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

export const tanggal = (iso: string, opts: { full?: boolean; withTime?: boolean } = {}) => {
  const d = new Date(iso);
  const day = d.getDate();
  const month = opts.full ? MONTHS_ID_FULL[d.getMonth()] : MONTHS_ID[d.getMonth()];
  const year = d.getFullYear();
  const base = `${day} ${month} ${year}`;
  if (opts.withTime) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${base}, ${hh}:${mm}`;
  }
  return base;
};

export const daysBetween = (isoA: string, isoB: string) => {
  const a = new Date(isoA).setHours(0, 0, 0, 0);
  const b = new Date(isoB).setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86_400_000);
};

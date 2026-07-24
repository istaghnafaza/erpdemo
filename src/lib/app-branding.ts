/** Nama produk — override via VITE_APP_NAME di .env / Railway */
export const APP_NAME = import.meta.env.VITE_APP_NAME?.trim() || "SEPS";
export const APP_TAGLINE = "Simetri ERP Store";

export function pageTitle(suffix: string): string {
  return `${suffix} — ${APP_NAME}`;
}

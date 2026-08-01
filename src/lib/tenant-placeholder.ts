/** Nama tenant sementara sampai wizard setup toko (step 2) diisi. */
export const PENDING_TENANT_DISPLAY_NAME = "Toko Baru";

export function isPendingTenantName(name: string | null | undefined): boolean {
  return !name?.trim() || name.trim() === PENDING_TENANT_DISPLAY_NAME;
}

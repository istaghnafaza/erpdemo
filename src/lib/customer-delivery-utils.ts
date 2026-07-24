// =============================================================================
// Customer delivery site helpers — labels, active filter, default pick.
// =============================================================================

import type {
  CustomerDeliverySite,
  CustomerSegment,
  DeliverySiteType,
} from "@/types/customer-delivery-sites";

export const CUSTOMER_SEGMENT_LABELS: Record<CustomerSegment, string> = {
  umum: "Pelanggan Umum",
  kontraktor: "Kontraktor",
  tukang_mandor: "Tukang / Mandor",
  musiman: "Pelanggan Musiman",
  instansi: "Instansi",
};

export const DELIVERY_SITE_TYPE_LABELS: Record<DeliverySiteType, string> = {
  proyek: "Proyek",
  kantor: "Kantor",
  gudang: "Gudang",
  rumah: "Rumah",
  toko: "Toko",
  lainnya: "Lainnya",
};

/** Proyek tanpa transaksi order selama ini otomatis nonaktif. */
export const PROJECT_IDLE_MS = 30 * 24 * 60 * 60 * 1000;

export function customerSegmentLabel(segment: CustomerSegment): string {
  return CUSTOMER_SEGMENT_LABELS[segment] ?? segment;
}

export function projectSiteReferenceAt(site: CustomerDeliverySite): string | null {
  return site.lastOrderAt ?? site.createdAt ?? null;
}

export function isProjectSiteIdle(
  site: CustomerDeliverySite,
  at: Date = new Date(),
): boolean {
  if (site.siteType !== "proyek") return false;
  const ref = projectSiteReferenceAt(site);
  if (!ref) return false;
  return at.getTime() - new Date(ref).getTime() > PROJECT_IDLE_MS;
}

export function isDeliverySiteActive(
  site: CustomerDeliverySite,
  at: Date = new Date(),
): boolean {
  if (!site.isActive) return false;
  if (site.siteType === "proyek" && isProjectSiteIdle(site, at)) return false;
  return true;
}

export function projectSiteStatusLabel(site: CustomerDeliverySite, at: Date = new Date()): string {
  if (!site.isActive) return "Nonaktif";
  if (site.siteType === "proyek" && isProjectSiteIdle(site, at)) {
    return "Nonaktif (idle 30 hari)";
  }
  return "Aktif";
}

export function listActiveSitesForCustomer(
  customerId: string,
  sites: CustomerDeliverySite[],
  at: Date = new Date(),
): CustomerDeliverySite[] {
  return sites
    .filter((s) => s.customerId === customerId && isDeliverySiteActive(s, at))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.label.localeCompare(b.label, "id");
    });
}

export function pickDefaultDeliverySite(
  sites: CustomerDeliverySite[],
): CustomerDeliverySite | null {
  if (sites.length === 0) return null;
  return sites.find((s) => s.isDefault) ?? sites[0];
}

/** Prioritas: terakhir dipakai (jika masih aktif) → default → pertama. */
export function pickPreferredDeliverySite(
  sites: CustomerDeliverySite[],
  lastUsedSiteId: string | null,
): CustomerDeliverySite | null {
  if (sites.length === 0) return null;
  if (lastUsedSiteId) {
    const last = sites.find((s) => s.id === lastUsedSiteId);
    if (last && isDeliverySiteActive(last)) return last;
  }
  return pickDefaultDeliverySite(sites);
}

export function resolveDeliveryAddress(
  site: CustomerDeliverySite | null,
  customerAddress: string | null | undefined,
  branchAddress: string | null | undefined,
): string {
  if (site?.address?.trim()) return site.address.trim();
  if (customerAddress?.trim()) return customerAddress.trim();
  if (branchAddress?.trim()) return branchAddress.trim();
  return "Alamat pengiriman belum diisi";
}

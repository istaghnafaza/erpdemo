// =============================================================================
// Customer delivery sites — saved addresses / projects (demo/localStorage).
// =============================================================================

export type CustomerSegment =
  | "umum"
  | "kontraktor"
  | "tukang_mandor"
  | "musiman"
  | "instansi";

export type DeliverySiteType = "proyek" | "kantor" | "gudang" | "rumah" | "toko" | "lainnya";

export interface CustomerDeliverySite {
  id: string;
  tenantId: string;
  customerId: string;
  label: string;
  address: string;
  contactName: string | null;
  contactPhone: string | null;
  siteType: DeliverySiteType;
  /** @deprecated — tidak dipakai UI; proyek dinonaktifkan otomatis setelah idle */
  validFrom: string | null;
  /** @deprecated */
  validUntil: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  /** Terakhir ada transaksi/order POS untuk lokasi ini */
  lastOrderAt: string | null;
}

export interface CreateDeliverySiteDraft {
  tenantId: string;
  customerId: string;
  label: string;
  address: string;
  contactName?: string | null;
  contactPhone?: string | null;
  siteType?: DeliverySiteType;
  isDefault?: boolean;
}

export interface UpdateDeliverySiteDraft {
  label?: string;
  address?: string;
  contactName?: string | null;
  contactPhone?: string | null;
  siteType?: DeliverySiteType;
  isDefault?: boolean;
  isActive?: boolean;
}

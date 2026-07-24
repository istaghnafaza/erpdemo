// =============================================================================
// Seed lokasi pengiriman pelanggan — demo tenant toko-simetri.
// =============================================================================

import { mockCustomerId } from "@/lib/mock-pos-catalog";
import { MOCK_TENANT_ID } from "@/stores/auth.store";
import type {
  CustomerDeliverySite,
  CustomerSegment,
} from "@/types/customer-delivery-sites";

function siteId(n: number): string {
  return `77771111-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

/** Segment per indeks CUSTOMERS di mock-data.ts */
export const MOCK_CUSTOMER_SEGMENTS: Record<string, CustomerSegment> = {
  [mockCustomerId(0)]: "kontraktor",
  [mockCustomerId(1)]: "umum",
  [mockCustomerId(2)]: "instansi",
  [mockCustomerId(3)]: "tukang_mandor",
  [mockCustomerId(4)]: "musiman",
};

export function getSeedCustomerDeliverySites(): CustomerDeliverySite[] {
  const c0 = mockCustomerId(0);
  const c1 = mockCustomerId(1);
  const c2 = mockCustomerId(2);
  const c3 = mockCustomerId(3);
  const c4 = mockCustomerId(4);

  return [
    // Kontraktor — PT Abadi Jaya Konstruksi
    {
      id: siteId(1),
      tenantId: MOCK_TENANT_ID,
      customerId: c0,
      label: "Proyek Sudirman Tower B",
      address: "Jl. Jend. Sudirman Kav 52-53, Site Tower B, Jakarta Pusat",
      contactName: "Pak Agus (Site Manager)",
      contactPhone: "0812-1111-2201",
      siteType: "proyek",
      validFrom: null,
      validUntil: null,
      isDefault: true,
      isActive: true,
      createdAt: "2026-01-15T08:00:00.000Z",
      lastOrderAt: "2026-06-25T10:00:00.000Z",
    },
    {
      id: siteId(2),
      tenantId: MOCK_TENANT_ID,
      customerId: c0,
      label: "Proyek Bekasi Cluster A",
      address: "Jl. Ahmad Yani KM 24, Cluster A Blok 3, Bekasi",
      contactName: "Ibu Rina (Logistik)",
      contactPhone: "0812-1111-2202",
      siteType: "proyek",
      validFrom: null,
      validUntil: null,
      isDefault: false,
      isActive: true,
      createdAt: "2026-03-01T08:00:00.000Z",
      lastOrderAt: "2026-06-10T14:00:00.000Z",
    },
    {
      id: siteId(3),
      tenantId: MOCK_TENANT_ID,
      customerId: c0,
      label: "Proyek Kemang (Selesai)",
      address: "Jl. Kemang Raya No. 8, Jakarta Selatan",
      contactName: null,
      contactPhone: null,
      siteType: "proyek",
      validFrom: null,
      validUntil: null,
      isDefault: false,
      isActive: false,
      createdAt: "2025-01-01T08:00:00.000Z",
      lastOrderAt: "2026-03-01T08:00:00.000Z",
    },

    // Umum — Toko Pak Budi
    {
      id: siteId(4),
      tenantId: MOCK_TENANT_ID,
      customerId: c1,
      label: "Toko Pak Budi",
      address: "Jl. Melati No. 18, Kebon Jeruk, Jakarta Barat",
      contactName: "Pak Budi",
      contactPhone: "0813-3333-4444",
      siteType: "toko",
      validFrom: null,
      validUntil: null,
      isDefault: true,
      isActive: true,
      createdAt: "2025-06-01T08:00:00.000Z",
      lastOrderAt: "2026-06-28T09:00:00.000Z",
    },

    // Instansi — CV Maju Bersama
    {
      id: siteId(5),
      tenantId: MOCK_TENANT_ID,
      customerId: c2,
      label: "Kantor Pusat",
      address: "Jl. Gatot Subroto No. 88, Jakarta Selatan",
      contactName: "Bag. Pengadaan",
      contactPhone: "0815-5555-6600",
      siteType: "kantor",
      validFrom: null,
      validUntil: null,
      isDefault: true,
      isActive: true,
      createdAt: "2025-01-01T08:00:00.000Z",
      lastOrderAt: null,
    },
    {
      id: siteId(6),
      tenantId: MOCK_TENANT_ID,
      customerId: c2,
      label: "Gudang Penerimaan",
      address: "Kawasan Pulo Gadung Blok JJ-12, Jakarta Timur",
      contactName: "Pak Joko (Gudang)",
      contactPhone: "0815-5555-6601",
      siteType: "gudang",
      validFrom: null,
      validUntil: null,
      isDefault: false,
      isActive: true,
      createdAt: "2025-01-01T08:00:00.000Z",
      lastOrderAt: null,
    },

    // Tukang / Mandor — Bapak Hendra
    {
      id: siteId(7),
      tenantId: MOCK_TENANT_ID,
      customerId: c3,
      label: "Site Renovasi Rumah",
      address: "Perumahan Green Valley Blok C-12, Tangerang",
      contactName: "Pak Hendra",
      contactPhone: "0817-7777-8888",
      siteType: "proyek",
      validFrom: null,
      validUntil: null,
      isDefault: true,
      isActive: true,
      createdAt: "2026-04-01T08:00:00.000Z",
      lastOrderAt: "2026-06-20T11:00:00.000Z",
    },
    {
      id: siteId(8),
      tenantId: MOCK_TENANT_ID,
      customerId: c3,
      label: "Alamat Rumah",
      address: "Jl. Mawar No. 5, Serpong, Tangerang Selatan",
      contactName: "Pak Hendra",
      contactPhone: "0817-7777-8888",
      siteType: "rumah",
      validFrom: null,
      validUntil: null,
      isDefault: false,
      isActive: true,
      createdAt: "2025-01-01T08:00:00.000Z",
      lastOrderAt: null,
    },

    // Musiman — PT Sentosa Properti
    {
      id: siteId(9),
      tenantId: MOCK_TENANT_ID,
      customerId: c4,
      label: "Booth Musim Ramadan",
      address: "Mal Grand Indonesia Lt. 3, Jakarta Pusat",
      contactName: "Tim Event",
      contactPhone: "0819-9999-0001",
      siteType: "toko",
      validFrom: null,
      validUntil: null,
      isDefault: true,
      isActive: true,
      createdAt: "2026-05-01T08:00:00.000Z",
      lastOrderAt: "2026-06-15T08:00:00.000Z",
    },
    {
      id: siteId(10),
      tenantId: MOCK_TENANT_ID,
      customerId: c4,
      label: "Booth Natal (Off-season)",
      address: "Plaza Senayan, Jakarta Selatan",
      contactName: null,
      contactPhone: null,
      siteType: "toko",
      validFrom: null,
      validUntil: null,
      isDefault: false,
      isActive: false,
      createdAt: "2025-12-01T08:00:00.000Z",
      lastOrderAt: "2025-12-28T08:00:00.000Z",
    },
  ];
}

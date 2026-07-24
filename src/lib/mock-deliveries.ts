// =============================================================================
// Seed pengiriman demo — konsisten dengan transaksi & cabang seed.
// =============================================================================

import {
  MOCK_BRANCH_BEKASI,
  MOCK_BRANCH_KEBONJERUK,
  MOCK_BRANCH_SUDIRMAN,
  MOCK_TENANT_ID,
} from "@/lib/mock-ids";
import { SEED_TENANT_USERS } from "@/lib/mock-users";
import type { DeliveryRecord } from "@/types/deliveries";

const BRANCH_NAMES: Record<string, string> = {
  [MOCK_BRANCH_SUDIRMAN]: "Cabang Sudirman",
  [MOCK_BRANCH_KEBONJERUK]: "Cabang Kebon Jeruk",
  [MOCK_BRANCH_BEKASI]: "Cabang Bekasi",
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10 + (n % 5), 30, 0, 0);
  return d.toISOString();
}

export function getSeedDeliveries(): DeliveryRecord[] {
  const andi = SEED_TENANT_USERS[3];
  const siti = SEED_TENANT_USERS[1];

  return [
    {
      id: "del-seed-001",
      tenantId: MOCK_TENANT_ID,
      branchId: MOCK_BRANCH_SUDIRMAN,
      branchName: BRANCH_NAMES[MOCK_BRANCH_SUDIRMAN],
      deliveryNumber: "DO-SDR-20260701-0001",
      salesTransactionId: "t2",
      transactionNumber: "TRX-2026-1043",
      orderFulfillmentType: "shipped",
      createdAt: daysAgo(0),
      customerName: "PT Sentosa Properti",
      customerPhone: "0819-9999-0000",
      deliveryAddress: "Jl. Gatot Subroto Kav. 12, Jakarta Selatan",
      deliverySiteId: null,
      deliverySiteLabel: "Kantor Pusat",
      cashierId: andi.id,
      cashierName: andi.name,
      paymentMethod: "transfer",
      grandTotal: 4_320_000,
      status: "preparing",
      scheduledDate: daysAgo(-1).slice(0, 10),
      driverName: "Budi Kurir",
      vehiclePlate: "B 1234 XYZ",
      deliveredAt: null,
      notes: "Material fragile — hati-hati angkat manual",
      isOfflineSale: false,
      items: [
        {
          id: "del-seed-001-i1",
          productId: "44441111-0000-0000-0000-000000000001",
          productName: "Semen Portland 50kg",
          sku: "BRG-001",
          unit: "sak",
          qtyOrdered: 40,
          qtyToDeliver: 40,
          qtyDelivered: 0,
        },
      ],
    },
    {
      id: "del-seed-002",
      tenantId: MOCK_TENANT_ID,
      branchId: MOCK_BRANCH_SUDIRMAN,
      branchName: BRANCH_NAMES[MOCK_BRANCH_SUDIRMAN],
      deliveryNumber: "DO-SDR-20260701-0002",
      salesTransactionId: "t4",
      transactionNumber: "TRX-2026-1045",
      orderFulfillmentType: "partial_shipped",
      createdAt: daysAgo(0),
      customerName: "Toko Pak Budi",
      customerPhone: "0813-3333-4444",
      deliveryAddress: "Jl. Melati No. 18, Kebon Jeruk, Jakarta Barat",
      deliverySiteId: "77771111-0000-0000-0000-000000000004",
      deliverySiteLabel: "Toko Pak Budi",
      cashierId: andi.id,
      cashierName: andi.name,
      paymentMethod: "credit",
      grandTotal: 1_650_000,
      status: "in_transit",
      scheduledDate: daysAgo(0).slice(0, 10),
      driverName: "Andi Driver",
      vehiclePlate: "B 5678 ABC",
      deliveredAt: null,
      notes: "Kirim sebagian dulu — sisa menyusul besok",
      isOfflineSale: false,
      items: [
        {
          id: "del-seed-002-i1",
          productId: "44441111-0000-0000-0000-000000000005",
          productName: "Keramik 40x40 Putih",
          sku: "BRG-005",
          unit: "dus",
          qtyOrdered: 8,
          qtyToDeliver: 5,
          qtyDelivered: 0,
        },
      ],
    },
    {
      id: "del-seed-004",
      tenantId: MOCK_TENANT_ID,
      branchId: MOCK_BRANCH_KEBONJERUK,
      branchName: BRANCH_NAMES[MOCK_BRANCH_KEBONJERUK],
      deliveryNumber: "DO-KBJ-20260629-0001",
      salesTransactionId: "seed-so-kbj",
      transactionNumber: "TRX-KBJ-20260629-0088",
      orderFulfillmentType: "shipped",
      createdAt: daysAgo(2),
      customerName: "CV Maju Bersama",
      customerPhone: "0815-5555-6666",
      deliveryAddress: "Jl. Panjang No. 22, Kebon Jeruk",
      cashierId: siti.id,
      cashierName: siti.name,
      paymentMethod: "transfer",
      grandTotal: 2_400_000,
      status: "pending",
      scheduledDate: null,
      driverName: null,
      vehiclePlate: null,
      deliveredAt: null,
      notes: null,
      isOfflineSale: false,
      items: [
        {
          id: "del-seed-004-i1",
          productId: "44441111-0000-0000-0000-000000000007",
          productName: "Besi Hollow 4x4",
          sku: "BRG-007",
          unit: "btg",
          qtyOrdered: 12,
          qtyToDeliver: 12,
          qtyDelivered: 0,
        },
      ],
    },
  ];
}

// =============================================================================
// Seed data — customer portal demo (tenant toko-simetri).
// =============================================================================

import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import type {
  CustomerPortalAccount,
  CustomerPortalConfig,
  OnlineOrder,
} from "@/types/customer-portal";

const MOCK_BRANCH_SUDIRMAN = "22221111-0000-0000-0000-000000000001";

export function getSeedPortalConfig(): CustomerPortalConfig {
  return {
    tenantId: MOCK_TENANT_ID,
    isActive: true,
    slug: "toko-simetri",
    storeDisplayName: "Toko Bangunan Simetri",
    whatsappNumber: "6281234567890",
    welcomeMessage:
      "Selamat datang! Pesan material bangunan online — stok real-time per cabang.",
    allowGuestBrowse: true,
    paymentMethods: {
      transfer: {
        enabled: true,
        bankName: "BCA",
        accountNumber: "1234567890",
        accountName: "Toko Bangunan Simetri",
      },
      gopay: {
        enabled: true,
        merchantPhone: "081234567890",
        merchantName: "Toko Bangunan Simetri",
      },
    },
  };
}

export function getSeedPortalAccounts(): CustomerPortalAccount[] {
  const now = new Date().toISOString();
  return [
    {
      id: "88881111-0000-0000-0000-000000000001",
      tenantId: MOCK_TENANT_ID,
      name: "Budi Santoso",
      email: "budi@email.com",
      phone: "081234567890",
      password: "123456",
      status: "active_transfer",
      creditLimit: 0,
      paymentTermDays: 0,
      outstandingDebt: 0,
      internalCustomerId: null,
      createdAt: "2025-01-08T08:00:00.000Z",
    },
    {
      id: "88881111-0000-0000-0000-000000000002",
      tenantId: MOCK_TENANT_ID,
      name: "PT Abadi Jaya Konstruksi",
      email: "procurement@abadijaya.id",
      phone: "02187654321",
      password: "123456",
      status: "member_tempo",
      creditLimit: 50_000_000,
      paymentTermDays: 30,
      outstandingDebt: 12_000_000,
      internalCustomerId: "66661111-0000-0000-0000-000000000000",
      createdAt: "2024-05-20T08:00:00.000Z",
    },
    {
      id: "88881111-0000-0000-0000-000000000003",
      tenantId: MOCK_TENANT_ID,
      name: "Hendra Wijaya",
      email: "hendra@gmail.com",
      phone: "08198765432",
      password: "123456",
      status: "pending_approval",
      creditLimit: 0,
      paymentTermDays: 0,
      outstandingDebt: 0,
      internalCustomerId: null,
      createdAt: "2025-01-14T08:00:00.000Z",
    },
  ];
}

export function getSeedOnlineOrders(): OnlineOrder[] {
  return [
    {
      id: "99991111-0000-0000-0000-000000000001",
      tenantId: MOCK_TENANT_ID,
      branchId: MOCK_BRANCH_SUDIRMAN,
      branchName: "Cabang Sudirman",
      orderNumber: "ORD-2026-0003",
      customerAccountId: "88881111-0000-0000-0000-000000000001",
      customerName: "Budi Santoso",
      customerPhone: "081234567890",
      items: [
        {
          productId: "44441111-0000-0000-0000-000000000000",
          productName: "Semen Portland 50kg",
          sku: "BRG-001",
          unit: "sak",
          qty: 10,
          sellingPrice: 65_000,
          subtotal: 650_000,
        },
        {
          productId: "44441111-0000-0000-0000-000000000002",
          productName: "Cat Tembok Putih 5kg",
          sku: "BRG-003",
          unit: "kaleng",
          qty: 5,
          sellingPrice: 45_000,
          subtotal: 225_000,
        },
      ],
      deliveryAddress: "Jl. Proyek Perumahan Blok A, Bekasi",
      notes: "Mohon kirim sebelum jam 10 pagi",
      subtotal: 875_000,
      grandTotal: 875_000,
      paymentMethod: "transfer",
      paymentStatus: "unpaid",
      paymentProofNote: null,
      paymentProofUploadedAt: null,
      paymentConfirmedAt: null,
      status: "approved",
      salesOrderId: null,
      createdAt: "2026-06-28T10:00:00.000Z",
      updatedAt: "2026-06-28T10:15:00.000Z",
    },
    {
      id: "99991111-0000-0000-0000-000000000002",
      tenantId: MOCK_TENANT_ID,
      branchId: MOCK_BRANCH_SUDIRMAN,
      branchName: "Cabang Sudirman",
      orderNumber: "ORD-2026-0002",
      customerAccountId: "88881111-0000-0000-0000-000000000002",
      customerName: "PT Abadi Jaya Konstruksi",
      customerPhone: "02187654321",
      items: [
        {
          productId: "44441111-0000-0000-0000-000000000000",
          productName: "Semen Portland 50kg",
          sku: "BRG-001",
          unit: "sak",
          qty: 50,
          sellingPrice: 65_000,
          subtotal: 3_250_000,
        },
      ],
      deliveryAddress: "Jl. Gatot Subroto No. 88, Jakarta",
      notes: "",
      subtotal: 3_250_000,
      grandTotal: 3_250_000,
      paymentMethod: "tempo",
      paymentStatus: "unpaid",
      paymentProofNote: null,
      paymentProofUploadedAt: null,
      paymentConfirmedAt: null,
      status: "processing",
      salesOrderId: null,
      createdAt: "2026-06-25T09:00:00.000Z",
      updatedAt: "2026-06-25T09:05:00.000Z",
    },
    {
      id: "99991111-0000-0000-0000-000000000003",
      tenantId: MOCK_TENANT_ID,
      branchId: MOCK_BRANCH_SUDIRMAN,
      branchName: "Cabang Sudirman",
      orderNumber: "ORD-2026-0001",
      customerAccountId: "88881111-0000-0000-0000-000000000001",
      customerName: "Budi Santoso",
      customerPhone: "081234567890",
      items: [
        {
          productId: "44441111-0000-0000-0000-000000000004",
          productName: "Pipa PVC 3/4\"",
          sku: "BRG-005",
          unit: "btg",
          qty: 20,
          sellingPrice: 22_000,
          subtotal: 440_000,
        },
      ],
      deliveryAddress: "Jl. Melati No. 18, Kebon Jeruk",
      notes: "",
      subtotal: 440_000,
      grandTotal: 440_000,
      paymentMethod: "transfer",
      paymentStatus: "confirmed",
      paymentProofNote: "Transfer BCA 28/06",
      paymentProofUploadedAt: "2026-06-20T14:00:00.000Z",
      paymentConfirmedAt: "2026-06-20T16:00:00.000Z",
      status: "completed",
      salesOrderId: null,
      createdAt: "2026-06-18T11:00:00.000Z",
      updatedAt: "2026-06-22T09:00:00.000Z",
    },
  ];
}

/** Demo credentials hint for login screen */
export const PORTAL_DEMO_LOGINS = [
  { email: "budi@email.com", password: "123456", label: "Transfer (aktif)" },
  { email: "procurement@abadijaya.id", password: "123456", label: "Member tempo" },
  { email: "hendra@gmail.com", password: "123456", label: "Menunggu approval" },
];

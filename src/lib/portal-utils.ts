// =============================================================================
// Portal helpers — stock label, status labels, tenant resolve.
// =============================================================================

import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import type {
  CustomerAccountStatus,
  CustomerPortalAccount,
  OnlineOrderStatus,
  PortalPaymentMethod,
  PortalStockLabel,
} from "@/types/customer-portal";
import type { Tenant } from "@/types/database";

const MOCK_TENANT_SLUG = "toko-simetri";

export function resolvePortalTenantBySlug(slug: string): Tenant | null {
  if (slug === MOCK_TENANT_SLUG) {
    return {
      id: MOCK_TENANT_ID,
      name: "Toko Bangunan Simetri",
      slug: MOCK_TENANT_SLUG,
      owner_email: "budi@simetri.id",
      phone: "021-5551234",
      plan: "pro",
      trial_ends_at: null,
      is_active: true,
      onboarding_complete: true,
      legacy_mode_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return null;
}

export function portalStockStatus(
  stock: number,
  legacyStock: number,
  reorderPoint: number,
): PortalStockLabel {
  const total = stock + legacyStock;
  if (total <= 0) return "out";
  if (total <= reorderPoint) return "limited";
  return "available";
}

export const PORTAL_STOCK_LABELS: Record<PortalStockLabel, string> = {
  available: "Tersedia",
  limited: "Terbatas",
  out: "Habis",
};

export const PORTAL_ACCOUNT_STATUS_LABELS: Record<CustomerAccountStatus, string> = {
  new: "Baru",
  pending_approval: "Menunggu Approval",
  active_transfer: "Aktif — Transfer",
  member_tempo: "Member — Tempo",
  blocked: "Diblokir",
};

export const ONLINE_ORDER_STATUS_LABELS: Record<OnlineOrderStatus, string> = {
  pending_approval: "Menunggu Konfirmasi Toko",
  approved: "Disetujui — Menunggu Bayar",
  payment_uploaded: "Bukti Diupload",
  processing: "Diproses",
  shipped: "Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  rejected: "Ditolak",
};

export const PORTAL_PAYMENT_LABELS: Record<PortalPaymentMethod, string> = {
  transfer: "Transfer Bank",
  gopay: "GoPay",
  tempo: "Tempo / Kredit",
};

export function canUseTempoPayment(account: CustomerPortalAccount | null): boolean {
  return account?.status === "member_tempo";
}

export function portalAccountStatusLabel(status: CustomerAccountStatus): string {
  return PORTAL_ACCOUNT_STATUS_LABELS[status] ?? status;
}

export function onlineOrderStatusLabel(status: OnlineOrderStatus): string {
  return ONLINE_ORDER_STATUS_LABELS[status] ?? status;
}

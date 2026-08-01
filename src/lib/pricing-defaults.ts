// =============================================================================
// Default pricing tiers — seed saat tenant belum punya konfigurasi
// =============================================================================

import type {
  CustomerPriceTier,
  PricingSettings,
  VolumePriceTier,
} from "@/types/pricing";

export function defaultPricingSettings(tenantId: string): PricingSettings {
  return {
    tenant_id: tenantId,
    max_stack_discount_percent: 12,
    max_line_discount_percent: 10,
    default_min_margin_percent: 10,
  };
}

export function defaultVolumeTiers(tenantId: string): Omit<VolumePriceTier, "id">[] {
  return [
    {
      tenant_id: tenantId,
      tier_code: "T0",
      name: "Eceran",
      min_qty: 0,
      min_line_amount: 0,
      discount_percent: 0,
      sort_order: 0,
      is_active: true,
    },
    {
      tenant_id: tenantId,
      tier_code: "T1",
      name: "Grosir Kecil",
      min_qty: 10,
      min_line_amount: 500_000,
      discount_percent: 3,
      sort_order: 1,
      is_active: true,
    },
    {
      tenant_id: tenantId,
      tier_code: "T2",
      name: "Grosir",
      min_qty: 50,
      min_line_amount: 2_000_000,
      discount_percent: 6,
      sort_order: 2,
      is_active: true,
    },
    {
      tenant_id: tenantId,
      tier_code: "T3",
      name: "Proyek",
      min_qty: 200,
      min_line_amount: 10_000_000,
      discount_percent: 8,
      sort_order: 3,
      is_active: true,
    },
  ];
}

export function defaultCustomerTiers(tenantId: string): Omit<CustomerPriceTier, "id">[] {
  return [
    {
      tenant_id: tenantId,
      tier_code: "P0",
      name: "Umum",
      discount_percent: 0,
      min_transactions: null,
      min_rolling_omzet: null,
      rolling_days: null,
      description: "Pelanggan walk-in / belum terdaftar",
      sort_order: 0,
      is_active: true,
    },
    {
      tenant_id: tenantId,
      tier_code: "P1",
      name: "Member",
      discount_percent: 2,
      min_transactions: 3,
      min_rolling_omzet: null,
      rolling_days: 90,
      description: "Min. 3 transaksi dalam 90 hari",
      sort_order: 1,
      is_active: true,
    },
    {
      tenant_id: tenantId,
      tier_code: "P2",
      name: "Silver",
      discount_percent: 4,
      min_transactions: null,
      min_rolling_omzet: 50_000_000,
      rolling_days: 365,
      description: "Omzet rolling 12 bln ≥ Rp 50 jt",
      sort_order: 2,
      is_active: true,
    },
    {
      tenant_id: tenantId,
      tier_code: "P3",
      name: "Kontraktor",
      discount_percent: 5,
      min_transactions: null,
      min_rolling_omzet: null,
      rolling_days: null,
      description: "Penetapan manual owner/manager + benefit tier volume",
      sort_order: 3,
      is_active: true,
    },
    {
      tenant_id: tenantId,
      tier_code: "P4",
      name: "Strategic Partner",
      discount_percent: 7,
      min_transactions: null,
      min_rolling_omzet: 500_000_000,
      rolling_days: 365,
      description: "Omzet rolling 12 bln ≥ Rp 500 jt",
      sort_order: 4,
      is_active: true,
    },
  ];
}

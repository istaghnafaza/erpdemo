// =============================================================================
// Pricing — tier volume, tier pelanggan, margin floor, engine I/O
// =============================================================================

export interface PricingSettings {
  tenant_id: string;
  max_stack_discount_percent: number;
  max_line_discount_percent: number;
  default_min_margin_percent: number;
  updated_at?: string;
  updated_by?: string | null;
}

export interface VolumePriceTier {
  id: string;
  tenant_id: string;
  tier_code: string;
  name: string;
  min_qty: number;
  min_line_amount: number;
  discount_percent: number;
  sort_order: number;
  is_active: boolean;
}

export interface CustomerPriceTier {
  id: string;
  tenant_id: string;
  tier_code: string;
  name: string;
  discount_percent: number;
  min_transactions: number | null;
  min_rolling_omzet: number | null;
  rolling_days: number | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface CategoryMarginFloor {
  id: string;
  tenant_id: string;
  category_id: string | null;
  min_margin_percent: number;
}

export interface PricingBundle {
  settings: PricingSettings;
  volume_tiers: VolumePriceTier[];
  customer_tiers: CustomerPriceTier[];
  category_margins: CategoryMarginFloor[];
}

export interface LinePricingInput {
  base_selling_price: number;
  purchase_price: number;
  qty: number;
  category_id?: string | null;
  customer_tier_discount_percent: number;
  is_so_line?: boolean;
  price_override_unit?: number | null;
  /** Total gross keranjang (non-SO) — untuk syarat min belanja tier volume. */
  cart_gross_subtotal?: number;
}

export interface LinePricingResult {
  base_selling_price: number;
  volume_tier_code: string;
  volume_tier_name: string;
  volume_discount_percent: number;
  customer_discount_percent: number;
  effective_discount_percent: number;
  unit_net_price: number;
  unit_discount_amount: number;
  floor_price: number;
  clamped_to_floor: boolean;
  /** Diskon tier dibatasi margin min per barang (anti rugi). */
  margin_limited_discount?: boolean;
  line_subtotal: number;
}

export interface PricingOverrideInput {
  tenant_id: string;
  branch_id: string;
  product_id: string | null;
  sku: string;
  base_price: number;
  floor_price: number;
  override_price: number;
  reason: string;
  created_by: string;
  sales_transaction_id?: string | null;
}

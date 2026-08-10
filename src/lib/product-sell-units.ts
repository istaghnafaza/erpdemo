// =============================================================================
// Konversi satuan jual → satuan dasar stok (Model A barang curah).
// =============================================================================

export interface SellUnitInput {
  id?: string;
  label: string;
  factor_to_base: number;
  selling_price?: number | null;
  purchase_price?: number | null;
  sort_order?: number;
  is_active?: boolean;
  allow_fraction?: boolean;
  preset_qty?: number[];
}

export interface ProductSellUnit {
  id: string;
  tenant_id: string;
  product_id: string;
  label: string;
  factor_to_base: number;
  selling_price: number | null;
  purchase_price: number | null;
  sort_order: number;
  is_active: boolean;
  allow_fraction: boolean;
  preset_qty: number[];
  created_at: string;
  updated_at: string;
}

/** Contoh default untuk pasir volume (toko bisa ubah faktor). */
export const PASIR_LAMAJANG_SELL_UNIT_TEMPLATE: SellUnitInput[] = [
  {
    label: "Truk",
    factor_to_base: 7,
    selling_price: 1_500_000,
    allow_fraction: true,
    preset_qty: [1],
    sort_order: 1,
  },
  {
    label: "Pikap",
    factor_to_base: 2.5,
    selling_price: 190_000,
    allow_fraction: true,
    preset_qty: [0.25, 0.5, 0.75, 1],
    sort_order: 2,
  },
  {
    label: "Sak",
    factor_to_base: 0.025,
    selling_price: 15_000,
    allow_fraction: true,
    preset_qty: [1, 5, 10],
    sort_order: 3,
  },
];

export function toBaseQty(sellQty: number, factorToBase: number): number {
  const q = Number(sellQty);
  const f = Number(factorToBase);
  if (!Number.isFinite(q) || !Number.isFinite(f) || f <= 0) return 0;
  return roundQty(q * f);
}

export function fromBaseQty(baseQty: number, factorToBase: number): number {
  const q = Number(baseQty);
  const f = Number(factorToBase);
  if (!Number.isFinite(q) || !Number.isFinite(f) || f <= 0) return 0;
  return roundQty(q / f);
}

export function roundQty(n: number, decimals = 4): number {
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

export function resolveSellPrice(
  unit: Pick<ProductSellUnit, "selling_price"> | SellUnitInput | null | undefined,
  branchSellingPrice: number,
): number {
  const override = unit?.selling_price;
  if (override != null && Number.isFinite(Number(override)) && Number(override) > 0) {
    return Math.round(Number(override));
  }
  return Math.round(branchSellingPrice);
}

export function formatStockInUnit(
  baseStock: number,
  factorToBase: number,
  unitLabel: string,
  stockUnit: string,
): string {
  const equiv = fromBaseQty(baseStock, factorToBase);
  return `${roundQty(baseStock)} ${stockUnit} ≈ ${roundQty(equiv)} ${unitLabel}`;
}

export function normalizePresetQty(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => roundQty(n));
}

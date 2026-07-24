// =============================================================================
// Mock POS catalog — demo/mock sessions (`loginAsMock`) have no real Supabase
// Auth JWT, so RLS blocks `branch_products` / `customers` queries for the
// seeded demo tenant (same root cause documented in branch.store.ts and
// mock-notifications.ts). This derives POS-ready data (BranchProductWithProduct,
// Customer, held-cart demo entries) from the shared src/lib/mock-data.ts so
// every module keeps showing the same numbers.
//
// Replaced by real `getBranchProducts()` / `getCustomers()` calls once
// Supabase Auth is live (Fase 15) — see usePos.ts, which already branches on
// `isMockTenant` and calls the real API for any other tenant.
// =============================================================================

import { PRODUCTS, CUSTOMERS, RECEIVABLES, type Product as MockProduct } from "@/lib/mock-data";
import { MOCK_TENANT_ID } from "@/stores/auth.store";
import type { BranchProductWithProduct, Customer, CartItem } from "@/types/database";

// ---------------------------------------------------------------------------
// Deterministic ID helpers — stable across renders/sessions (not random)
// ---------------------------------------------------------------------------

export function productId(index: number): string {
  return `44441111-0000-0000-0000-${String(index).padStart(12, "0")}`;
}

function branchProductId(branchIndex: number, index: number): string {
  return `55551111-000${branchIndex}-0000-0000-${String(index).padStart(12, "0")}`;
}

export function mockCustomerId(index: number): string {
  return `66661111-0000-0000-0000-${String(index).padStart(12, "0")}`;
}

const SKU_PREFIX = "BRG-";

/** SKU berikutnya (BRG-001, BRG-002, …) dari daftar SKU yang sudah ada. */
export function generateNextProductSku(existingSkus: Iterable<string>): string {
  let max = 0;
  for (const raw of existingSkus) {
    const m = /^BRG-(\d+)$/i.exec(raw.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${SKU_PREFIX}${String(max + 1).padStart(3, "0")}`;
}

// Branch order must match MOCK_BRANCHES in auth.store.ts (Sudirman, Kebon Jeruk, Bekasi)
const BRANCH_STOCK_MULTIPLIER = [1, 0.6, 0.35];

/** Returns the branch's index (0-2) within MOCK_BRANCHES, defaulting to 0 (Sudirman). */
function branchIndexOf(branchId: string): number {
  const idx = [
    "22221111-0000-0000-0000-000000000001",
    "22221111-0000-0000-0000-000000000002",
    "22221111-0000-0000-0000-000000000003",
  ].indexOf(branchId);
  return idx === -1 ? 0 : idx;
}

// ---------------------------------------------------------------------------
// Products / branch_products
// ---------------------------------------------------------------------------

function toDbProduct(p: MockProduct, index: number): BranchProductWithProduct["product"] {
  return {
    id: productId(index),
    tenant_id: MOCK_TENANT_ID,
    sku: p.sku,
    barcode: null,
    name: p.name,
    category_id: null,
    unit: p.unit,
    purchase_price: p.costPrice,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Returns the full POS catalog (all products) for a given mock branch. */
export function getMockPosCatalog(branchId: string): BranchProductWithProduct[] {
  const bIdx = branchIndexOf(branchId);
  const mult = BRANCH_STOCK_MULTIPLIER[bIdx] ?? 0.5;

  return PRODUCTS.map((p, i) => {
    const stock = Math.max(0, Math.round(p.stock * mult));
    return {
      id: branchProductId(bIdx, i),
      tenant_id: MOCK_TENANT_ID,
      branch_id: branchId,
      product_id: productId(i),
      selling_price: p.sellPrice,
      stock,
      legacy_stock: 0,
      reorder_point: p.minStock,
      warehouse_location: p.location,
      product: toDbProduct(p, i),
    };
  });
}

export const MOCK_CATEGORIES: string[] = Array.from(new Set(PRODUCTS.map((p) => p.category)));

/** sku -> category display name, used by usePos.ts to label mock catalog items
 *  (mock products don't have a real category_id / product_categories join). */
export const MOCK_SKU_CATEGORY: Record<string, string> = Object.fromEntries(
  PRODUCTS.map((p) => [p.sku, p.category]),
);

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/** perusahaan (company) => credit-eligible; perorangan (individual) => retail/cash only */
export const MOCK_POS_CUSTOMERS: Customer[] = CUSTOMERS.map((c, i) => {
  const isCredit = c.type === "perusahaan";
  const outstandingDebt = RECEIVABLES.filter((r) => r.customerId === c.id).reduce(
    (s, r) => s + (r.amount - r.paid),
    0,
  );

  return {
    id: mockCustomerId(i),
    tenant_id: MOCK_TENANT_ID,
    name: c.name,
    phone: c.phone,
    address: null,
    type: isCredit ? "credit" : "retail",
    credit_limit: isCredit ? 50_000_000 : 0,
    outstanding_debt: isCredit ? outstandingDebt : 0,
    created_at: new Date().toISOString(),
  };
});

// ---------------------------------------------------------------------------
// Held carts from "other cashiers" — for TakeoverModal demo.
// A single-browser demo has no real concurrent cashiers, so this simulates
// a realistic scenario: another cashier held a cart mid-transaction.
// ---------------------------------------------------------------------------

export interface MockHeldCart {
  id: string;
  cashierName: string;
  cartLabel: string;
  customer: Customer | null;
  items: CartItem[];
  heldAt: string; // ISO
}

function heldItem(index: number, qty: number, branchId: string): CartItem {
  const catalog = getMockPosCatalog(branchId);
  const bp = catalog[index];
  const subtotal = bp.selling_price * qty;
  return {
    product_id: bp.product_id,
    branch_product_id: bp.id,
    sku: bp.product.sku,
    name: bp.product.name,
    unit: bp.product.unit,
    qty,
    selling_price: bp.selling_price,
    purchase_price: bp.product.purchase_price,
    discount: 0,
    subtotal,
    stock_source: "verified",
    available_stock: bp.stock,
  };
}

export function getMockHeldCarts(branchId: string): MockHeldCart[] {
  const now = Date.now();
  return [
    {
      id: "held-cart-1",
      cashierName: "Siti Rahma",
      cartLabel: "Keranjang #2",
      customer: MOCK_POS_CUSTOMERS[1] ?? null,
      items: [heldItem(0, 4, branchId), heldItem(4, 2, branchId)],
      heldAt: new Date(now - 14 * 60 * 1000).toISOString(),
    },
    {
      id: "held-cart-2",
      cashierName: "Rudi Hermawan",
      cartLabel: "Keranjang #1",
      customer: null,
      items: [heldItem(2, 1, branchId)],
      heldAt: new Date(now - 6 * 60 * 1000).toISOString(),
    },
  ];
}

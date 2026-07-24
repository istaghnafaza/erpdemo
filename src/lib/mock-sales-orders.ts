// =============================================================================
// Mock Sales Orders — demo data for loginAsMock sessions (no Supabase JWT).
// =============================================================================

import { PRODUCTS, CUSTOMERS } from "@/lib/mock-data";
import { MOCK_TENANT_ID } from "@/stores/auth.store";
import { mockCustomerId, productId } from "@/lib/mock-pos-catalog";
import type { SalesOrder, SalesOrderItem, SoFulfillment } from "@/types/database";

const BRANCH_SUDIRMAN = "22221111-0000-0000-0000-000000000001";
const MOCK_USER_OWNER = "33331111-0000-0000-0000-000000000001";
const MOCK_USER_MANAGER = "33331111-0000-0000-0000-000000000002";

export const MOCK_SUPPLIER_SEMEN = "77771111-0000-0000-0000-000000000001";
export const MOCK_SUPPLIER_BESI = "77771111-0000-0000-0000-000000000002";

export const MOCK_SUPPLIERS = [
  { id: MOCK_SUPPLIER_SEMEN, name: "PT Sumber Semen Indonesia" },
  { id: MOCK_SUPPLIER_BESI, name: "Toko Besi Makmur" },
];

function soId(n: number): string {
  return `99991111-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

function soItemId(soN: number, itemN: number): string {
  return `99992111-000${soN}-0000-0000-${String(itemN).padStart(12, "0")}`;
}

function fulfillmentId(soN: number, itemN: number, fN: number): string {
  return `99993111-000${soN}-000${itemN}-0000-${String(fN).padStart(8, "0")}`;
}

export interface MockIndentPoLineRef {
  so_item_id: string;
  qty: number;
}

export interface MockIndentPoRef {
  id: string;
  po_number: string;
  sales_order_id: string;
  supplier_id: string;
  supplier_name: string;
  /** Satu PO indent bisa berisi beberapa baris SO (supplier sama). */
  lines: MockIndentPoLineRef[];
  status: "draft" | "sent";
}

export interface MockSalesOrderItem extends SalesOrderItem {
  fulfillments: SoFulfillment[];
}

export interface MockSalesOrderWithDetails extends SalesOrder {
  items: MockSalesOrderItem[];
  customer?: { name: string; phone: string | null };
  indent_pos: MockIndentPoRef[];
  ar_invoice_number: string | null;
  /** SO dari checkout POS (bukan tombol SO Baru) */
  source?: "pos" | "manual";
  pos_transaction_id?: string | null;
  pos_transaction_number?: string | null;
}

let localSoSeq = 5;
let localIndentPoSeq = 2;

export function getNextMockSoNumber(): string {
  return `SO-${new Date().getFullYear()}-${String(localSoSeq++).padStart(4, "0")}`;
}

export function getNextMockSoId(): string {
  return `99991111-0000-0000-0000-${String(100 + localSoSeq).padStart(12, "0")}`;
}

export function getNextMockSoItemId(soIdVal: string): string {
  return `99992111-0000-0000-0000-${soIdVal.slice(-8)}${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`;
}

export function getNextMockFulfillmentId(): string {
  return `99993111-0000-0000-0000-${String(Math.floor(Math.random() * 999999)).padStart(12, "0")}`;
}

export function getNextMockIndentPoNumber(): string {
  return `PO-IND-${new Date().getFullYear()}-${String(localIndentPoSeq++).padStart(4, "0")}`;
}

export function getNextMockInvoiceNumber(): string {
  return `INV-${new Date().getFullYear()}-${String(localSoSeq + 50).padStart(4, "0")}`;
}

/** Seed sales orders in various statuses for demo UI. */
export function getSeedMockSalesOrders(): MockSalesOrderWithDetails[] {
  const semen = PRODUCTS[0];
  const bata = PRODUCTS[1];
  const keramik = PRODUCTS[5];
  const c1 = CUSTOMERS[0]; // PT Abadi
  const c3 = CUSTOMERS[2]; // CV Maju

  const daysAhead = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };

  return [
    {
      id: soId(1),
      tenant_id: MOCK_TENANT_ID,
      branch_id: BRANCH_SUDIRMAN,
      so_number: "SO-2026-0001",
      customer_id: mockCustomerId(0),
      customer_name: c1.name,
      delivery_address: "Jl. Proyek Sudirman Kav 12, Jakarta",
      subtotal: 50 * semen.sellPrice,
      discount_amount: 0,
      grand_total: 50 * semen.sellPrice,
      down_payment: 10_000_000,
      remaining_payment: 50 * semen.sellPrice - 10_000_000,
      status: "draft",
      payment_status: "partial",
      estimated_delivery_date: daysAhead(7),
      notes: "Pengiriman bertahap — proyek apartemen",
      created_by: MOCK_USER_MANAGER,
      created_at: daysAgo(1),
      customer: { name: c1.name, phone: c1.phone },
      indent_pos: [],
      ar_invoice_number: null,
      items: [
        {
          id: soItemId(1, 1),
          so_id: soId(1),
          tenant_id: MOCK_TENANT_ID,
          product_id: productId(0),
          product_name: semen.name,
          sku: semen.sku,
          unit: semen.unit,
          qty: 50,
          selling_price: semen.sellPrice,
          discount: 0,
          subtotal: 50 * semen.sellPrice,
          delivered_qty: 0,
          status: "pending",
          fulfillments: [],
        },
      ],
    },
    {
      id: soId(2),
      tenant_id: MOCK_TENANT_ID,
      branch_id: BRANCH_SUDIRMAN,
      so_number: "SO-2026-0002",
      customer_id: mockCustomerId(2),
      customer_name: c3.name,
      delivery_address: "Jl. Ahmad Yani No. 45, Bekasi",
      subtotal: 200 * bata.sellPrice + 10 * keramik.sellPrice,
      discount_amount: 500_000,
      grand_total: 200 * bata.sellPrice + 10 * keramik.sellPrice - 500_000,
      down_payment: 0,
      remaining_payment: 200 * bata.sellPrice + 10 * keramik.sellPrice - 500_000,
      status: "confirmed",
      payment_status: "unpaid",
      estimated_delivery_date: daysAhead(14),
      notes: null,
      created_by: MOCK_USER_OWNER,
      created_at: daysAgo(3),
      customer: { name: c3.name, phone: c3.phone },
      indent_pos: [],
      ar_invoice_number: null,
      items: [
        {
          id: soItemId(2, 1),
          so_id: soId(2),
          tenant_id: MOCK_TENANT_ID,
          product_id: productId(1),
          product_name: bata.name,
          sku: bata.sku,
          unit: bata.unit,
          qty: 200,
          selling_price: bata.sellPrice,
          discount: 0,
          subtotal: 200 * bata.sellPrice,
          delivered_qty: 0,
          status: "pending",
          fulfillments: [],
        },
        {
          id: soItemId(2, 2),
          so_id: soId(2),
          tenant_id: MOCK_TENANT_ID,
          product_id: productId(5),
          product_name: keramik.name,
          sku: keramik.sku,
          unit: keramik.unit,
          qty: 10,
          selling_price: keramik.sellPrice,
          discount: 500_000,
          subtotal: 10 * keramik.sellPrice - 500_000,
          delivered_qty: 0,
          status: "pending",
          fulfillments: [],
        },
      ],
    },
    {
      id: soId(3),
      tenant_id: MOCK_TENANT_ID,
      branch_id: BRANCH_SUDIRMAN,
      so_number: "SO-2026-0003",
      customer_id: mockCustomerId(0),
      customer_name: c1.name,
      delivery_address: "Site Proyek Sudirman — Tower B",
      subtotal: 30 * semen.sellPrice + 15 * PRODUCTS[6].sellPrice,
      discount_amount: 0,
      grand_total: 30 * semen.sellPrice + 15 * PRODUCTS[6].sellPrice,
      down_payment: 5_000_000,
      remaining_payment: 30 * semen.sellPrice + 15 * PRODUCTS[6].sellPrice - 5_000_000,
      status: "partial_delivered",
      payment_status: "partial",
      estimated_delivery_date: daysAhead(5),
      notes: "Item hollow indent — menunggu supplier",
      created_by: MOCK_USER_MANAGER,
      created_at: daysAgo(7),
      customer: { name: c1.name, phone: c1.phone },
      indent_pos: [
        {
          id: "aa991111-0000-0000-0000-000000000001",
          po_number: "PO-IND-2026-0001",
          sales_order_id: soId(3),
          supplier_id: MOCK_SUPPLIER_BESI,
          supplier_name: "Toko Besi Makmur",
          status: "sent",
          lines: [{ so_item_id: soItemId(3, 2), qty: 10 }],
        },
      ],
      ar_invoice_number: null,
      items: [
        {
          id: soItemId(3, 1),
          so_id: soId(3),
          tenant_id: MOCK_TENANT_ID,
          product_id: productId(0),
          product_name: semen.name,
          sku: semen.sku,
          unit: semen.unit,
          qty: 30,
          selling_price: semen.sellPrice,
          discount: 0,
          subtotal: 30 * semen.sellPrice,
          delivered_qty: 30,
          status: "fulfilled",
          fulfillments: [
            {
              id: fulfillmentId(3, 1, 1),
              so_item_id: soItemId(3, 1),
              tenant_id: MOCK_TENANT_ID,
              source: "stock",
              qty: 30,
              purchase_order_id: null,
              supplier_id: null,
              purchase_price_at_time: semen.costPrice,
              status: "delivered",
            },
          ],
        },
        {
          id: soItemId(3, 2),
          so_id: soId(3),
          tenant_id: MOCK_TENANT_ID,
          product_id: productId(6),
          product_name: PRODUCTS[6].name,
          sku: PRODUCTS[6].sku,
          unit: PRODUCTS[6].unit,
          qty: 15,
          selling_price: PRODUCTS[6].sellPrice,
          discount: 0,
          subtotal: 15 * PRODUCTS[6].sellPrice,
          delivered_qty: 5,
          status: "partial",
          fulfillments: [
            {
              id: fulfillmentId(3, 2, 1),
              so_item_id: soItemId(3, 2),
              tenant_id: MOCK_TENANT_ID,
              source: "stock",
              qty: 5,
              purchase_order_id: null,
              supplier_id: null,
              purchase_price_at_time: PRODUCTS[6].costPrice,
              status: "delivered",
            },
            {
              id: fulfillmentId(3, 2, 2),
              so_item_id: soItemId(3, 2),
              tenant_id: MOCK_TENANT_ID,
              source: "indent",
              qty: 10,
              purchase_order_id: null,
              supplier_id: MOCK_SUPPLIER_BESI,
              purchase_price_at_time: PRODUCTS[6].costPrice,
              status: "in_progress",
            },
          ],
        },
      ],
    },
    {
      id: soId(4),
      tenant_id: MOCK_TENANT_ID,
      branch_id: BRANCH_SUDIRMAN,
      so_number: "SO-2026-0004",
      customer_id: mockCustomerId(4),
      customer_name: CUSTOMERS[4].name,
      delivery_address: "Cluster Sentosa Blok C-12, Tangerang",
      subtotal: 20 * keramik.sellPrice,
      discount_amount: 0,
      grand_total: 20 * keramik.sellPrice,
      down_payment: 20 * keramik.sellPrice,
      remaining_payment: 0,
      status: "completed",
      payment_status: "paid",
      estimated_delivery_date: daysAgo(2).slice(0, 10),
      notes: "Selesai — siap invoice",
      created_by: MOCK_USER_OWNER,
      created_at: daysAgo(14),
      customer: { name: CUSTOMERS[4].name, phone: CUSTOMERS[4].phone },
      indent_pos: [],
      ar_invoice_number: null,
      items: [
        {
          id: soItemId(4, 1),
          so_id: soId(4),
          tenant_id: MOCK_TENANT_ID,
          product_id: productId(5),
          product_name: keramik.name,
          sku: keramik.sku,
          unit: keramik.unit,
          qty: 20,
          selling_price: keramik.sellPrice,
          discount: 0,
          subtotal: 20 * keramik.sellPrice,
          delivered_qty: 20,
          status: "fulfilled",
          fulfillments: [
            {
              id: fulfillmentId(4, 1, 1),
              so_item_id: soItemId(4, 1),
              tenant_id: MOCK_TENANT_ID,
              source: "stock",
              qty: 20,
              purchase_order_id: null,
              supplier_id: null,
              purchase_price_at_time: keramik.costPrice,
              status: "delivered",
            },
          ],
        },
      ],
    },
  ];
}

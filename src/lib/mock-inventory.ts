// =============================================================================
// Mock inventory data — demo sessions have no Supabase JWT, so RLS blocks
// inventory queries. Seeds transfers + movement history derived from
// mock-data.ts; runtime mutations live in inventory.store.ts.
// =============================================================================

import { STOCK_MOVEMENTS, PRODUCTS } from "@/lib/mock-data";
import { MOCK_TENANT_ID } from "@/stores/auth.store";
import { productId } from "@/lib/mock-pos-catalog";
import type { StockMovement, StockTransfer, StockTransferItem } from "@/types/database";

const BRANCH_SUDIRMAN = "22221111-0000-0000-0000-000000000001";
const BRANCH_KEBONJERUK = "22221111-0000-0000-0000-000000000002";
const BRANCH_BEKASI = "22221111-0000-0000-0000-000000000003";

const MOCK_USER_OWNER = "33331111-0000-0000-0000-000000000001";
const MOCK_USER_WAREHOUSE = "33331111-0000-0000-0000-000000000004";

function skuIndex(sku: string): number {
  return PRODUCTS.findIndex((p) => p.sku === sku);
}

function movementId(index: number): string {
  return `77771111-0000-0000-0000-${String(index).padStart(12, "0")}`;
}

function transferId(index: number): string {
  return `88881111-0000-0000-0000-${String(index).padStart(12, "0")}`;
}

function transferItemId(transferIndex: number, itemIndex: number): string {
  return `88891111-000${transferIndex}-0000-0000-${String(itemIndex).padStart(12, "0")}`;
}

/** Seed stock movements for mock tenant (Sudirman branch). */
export function getSeedMockMovements(): StockMovement[] {
  return STOCK_MOVEMENTS.map((m, i) => {
    const idx = skuIndex(m.sku);
    const product = PRODUCTS[idx];
    const type =
      m.type === "in" ? "in" : m.type === "out" ? "out" : ("adjustment" as const);
    const qtyBefore =
      type === "in" ? Math.max(0, product.stock - m.qty) : product.stock + m.qty;

    return {
      id: movementId(i + 1),
      tenant_id: MOCK_TENANT_ID,
      branch_id: BRANCH_SUDIRMAN,
      product_id: productId(idx),
      type,
      stock_source: "verified" as const,
      qty: m.qty,
      qty_before: qtyBefore,
      qty_after: type === "in" ? qtyBefore + m.qty : qtyBefore - m.qty,
      reference: m.ref,
      notes: m.note,
      user_id: MOCK_USER_OWNER,
      created_at: m.date,
    };
  });
}

export interface MockTransferWithItems extends StockTransfer {
  items: StockTransferItem[];
  from_branch?: { name: string };
  to_branch?: { name: string };
}

/** Seed stock transfers in various statuses for demo UI. */
export function getSeedMockTransfers(): MockTransferWithItems[] {
  const semen = PRODUCTS[0];
  const cat = PRODUCTS[2];
  const bata = PRODUCTS[1];

  return [
    {
      id: transferId(1),
      tenant_id: MOCK_TENANT_ID,
      transfer_number: "TRF-2026-0003",
      from_branch_id: BRANCH_SUDIRMAN,
      to_branch_id: BRANCH_KEBONJERUK,
      status: "sent",
      notes: "Restock cabang Kebon Jeruk — permintaan manager",
      created_by: MOCK_USER_WAREHOUSE,
      confirmed_by: null,
      sent_at: new Date(Date.now() - 86400000).toISOString(),
      received_at: null,
      created_at: new Date(Date.now() - 172800000).toISOString(),
      from_branch: { name: "Cabang Sudirman" },
      to_branch: { name: "Cabang Kebon Jeruk" },
      items: [
        {
          id: transferItemId(1, 1),
          transfer_id: transferId(1),
          tenant_id: MOCK_TENANT_ID,
          product_id: productId(0),
          product_name: semen.name,
          sku: semen.sku,
          unit: semen.unit,
          requested_qty: 20,
          sent_qty: 20,
          received_qty: 0,
        },
        {
          id: transferItemId(1, 2),
          transfer_id: transferId(1),
          tenant_id: MOCK_TENANT_ID,
          product_id: productId(2),
          product_name: cat.name,
          sku: cat.sku,
          unit: cat.unit,
          requested_qty: 10,
          sent_qty: 10,
          received_qty: 0,
        },
      ],
    },
    {
      id: transferId(2),
      tenant_id: MOCK_TENANT_ID,
      transfer_number: "TRF-2026-0002",
      from_branch_id: BRANCH_SUDIRMAN,
      to_branch_id: BRANCH_BEKASI,
      status: "received",
      notes: null,
      created_by: MOCK_USER_WAREHOUSE,
      confirmed_by: MOCK_USER_OWNER,
      sent_at: new Date(Date.now() - 604800000).toISOString(),
      received_at: new Date(Date.now() - 518400000).toISOString(),
      created_at: new Date(Date.now() - 691200000).toISOString(),
      from_branch: { name: "Cabang Sudirman" },
      to_branch: { name: "Cabang Bekasi" },
      items: [
        {
          id: transferItemId(2, 1),
          transfer_id: transferId(2),
          tenant_id: MOCK_TENANT_ID,
          product_id: productId(1),
          product_name: bata.name,
          sku: bata.sku,
          unit: bata.unit,
          requested_qty: 500,
          sent_qty: 500,
          received_qty: 500,
        },
      ],
    },
    {
      id: transferId(3),
      tenant_id: MOCK_TENANT_ID,
      transfer_number: "TRF-2026-0004",
      from_branch_id: BRANCH_KEBONJERUK,
      to_branch_id: BRANCH_BEKASI,
      status: "draft",
      notes: "Draft — menunggu konfirmasi qty",
      created_by: MOCK_USER_WAREHOUSE,
      confirmed_by: null,
      sent_at: null,
      received_at: null,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      from_branch: { name: "Cabang Kebon Jeruk" },
      to_branch: { name: "Cabang Bekasi" },
      items: [
        {
          id: transferItemId(3, 1),
          transfer_id: transferId(3),
          tenant_id: MOCK_TENANT_ID,
          product_id: productId(6),
          product_name: PRODUCTS[6].name,
          sku: PRODUCTS[6].sku,
          unit: PRODUCTS[6].unit,
          requested_qty: 10,
          sent_qty: 10,
          received_qty: 0,
        },
      ],
    },
  ];
}

let localTransferSeq = 5;

export function getNextMockTransferNumber(): string {
  const year = new Date().getFullYear();
  const num = String(localTransferSeq++).padStart(4, "0");
  return `TRF-${year}-${num}`;
}

let localOpnameSeq = 3;

export function getNextMockOpnameReference(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `OPNAME-${date}-${String(localOpnameSeq++).padStart(3, "0")}`;
}

let localMovementSeq = 100;

export function getNextMockMovementId(): string {
  return `77771111-0000-0000-0000-${String(localMovementSeq++).padStart(12, "0")}`;
}

let localTransferIdSeq = 10;

export function getNextMockTransferId(): string {
  return `88881111-0000-0000-0000-${String(localTransferIdSeq++).padStart(12, "0")}`;
}

export function getNextMockTransferItemId(transferIdVal: string): string {
  const suffix = transferIdVal.slice(-4);
  return `88891111-0000-0000-0000-${suffix}${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;
}

// =============================================================================
// Mock Purchasing — PO, GR, suppliers for demo sessions (no Supabase JWT).
// =============================================================================

import { PRODUCTS, PURCHASE_ORDERS } from "@/lib/mock-data";
import { MOCK_TENANT_ID } from "@/stores/auth.store";
import { productId } from "@/lib/mock-pos-catalog";
import { MOCK_SUPPLIER_SEMEN, MOCK_SUPPLIER_BESI } from "@/lib/mock-sales-orders";
import type { PurchaseOrder, PoItem, GoodsReceipt, GrItem, Supplier } from "@/types/database";

const BRANCH_SUDIRMAN = "22221111-0000-0000-0000-000000000001";
const MOCK_USER_OWNER = "33331111-0000-0000-0000-000000000001";

export const MOCK_SUPPLIER_CAT = "77771111-0000-0000-0000-000000000003";
export const MOCK_SUPPLIER_STEEL = "77771111-0000-0000-0000-000000000004";

export const MOCK_SUPPLIER_LIST: Supplier[] = [
  {
    id: MOCK_SUPPLIER_SEMEN,
    tenant_id: MOCK_TENANT_ID,
    name: "PT Sumber Semen Indonesia",
    contact_person: "Pak Hari",
    phone: "081234567890",
    address: "Jakarta",
    email: null,
    payment_term_days: 30,
    outstanding_debt: 25_000_000,
    is_active: true,
  },
  {
    id: MOCK_SUPPLIER_BESI,
    tenant_id: MOCK_TENANT_ID,
    name: "Toko Besi Makmur",
    contact_person: "Bu Ani",
    phone: "081298765432",
    address: "Jakarta Barat",
    email: null,
    payment_term_days: 14,
    outstanding_debt: 8_500_000,
    is_active: true,
  },
  {
    id: MOCK_SUPPLIER_CAT,
    tenant_id: MOCK_TENANT_ID,
    name: "PT Avia Avian (Cat)",
    contact_person: "Pak Rudi",
    phone: "021-555-3030",
    address: null,
    email: null,
    payment_term_days: 30,
    outstanding_debt: 6_800_000,
    is_active: true,
  },
  {
    id: MOCK_SUPPLIER_STEEL,
    tenant_id: MOCK_TENANT_ID,
    name: "PT Krakatau Steel",
    contact_person: "Bu Dewi",
    phone: "021-555-4040",
    address: null,
    email: null,
    payment_term_days: 30,
    outstanding_debt: 9_200_000,
    is_active: true,
  },
];

const SUPPLIER_MAP: Record<string, string> = {
  s1: MOCK_SUPPLIER_SEMEN,
  s2: MOCK_SUPPLIER_BESI,
  s3: MOCK_SUPPLIER_CAT,
  s4: MOCK_SUPPLIER_STEEL,
};

function poId(n: number): string {
  return `aaa91111-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

function poItemId(poN: number, itemN: number): string {
  return `aaa91112-000${poN}-0000-0000-${String(itemN).padStart(12, "0")}`;
}

function grId(n: number): string {
  return `aaa92111-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

function grItemId(grN: number, itemN: number): string {
  return `aaa92112-000${grN}-0000-0000-${String(itemN).padStart(12, "0")}`;
}

function skuIndex(sku: string): number {
  return PRODUCTS.findIndex((p) => p.sku === sku);
}

function mapPoStatus(s: "draft" | "sent" | "received" | "partial"): PurchaseOrder["status"] {
  if (s === "partial") return "partial_received";
  return s;
}

export type MockPoItem = PoItem & { so_item_id?: string | null };

export interface MockPoWithItems extends PurchaseOrder {
  items: MockPoItem[];
  supplier?: { name: string };
  sales_order_number?: string | null;
  /** Legacy — PO indent multi-item pakai so_item_id per baris PO */
  so_item_id?: string | null;
}

export interface MockGrWithItems extends GoodsReceipt {
  items: GrItem[];
  po_number?: string;
  po_type?: PurchaseOrder["type"];
  supplier?: { name: string };
}

let localPoSeq = 200;
let localGrSeq = 50;

export function getNextMockPoNumber(type: PurchaseOrder["type"]): string {
  const prefix = type === "indent" ? "PO-IND" : "PO";
  return `${prefix}-${new Date().getFullYear()}-${String(localPoSeq++).padStart(4, "0")}`;
}

export function getNextMockPoId(): string {
  return `aaa91111-0000-0000-0000-${String(localPoSeq + 500).padStart(12, "0")}`;
}

export function getNextMockPoItemId(): string {
  return `aaa91112-0000-0000-0000-${String(Math.floor(Math.random() * 999999)).padStart(12, "0")}`;
}

export function getNextMockGrNumber(): string {
  return `GR-${new Date().getFullYear()}-${String(localGrSeq++).padStart(4, "0")}`;
}

export function getNextMockGrId(): string {
  return `aaa92111-0000-0000-0000-${String(localGrSeq + 200).padStart(12, "0")}`;
}

export function getNextMockGrItemId(): string {
  return `aaa92112-0000-0000-0000-${String(Math.floor(Math.random() * 999999)).padStart(12, "0")}`;
}

export function getSeedMockPurchaseOrders(): MockPoWithItems[] {
  return PURCHASE_ORDERS.map((po, idx) => {
    const n = idx + 1;
    const supplierId = SUPPLIER_MAP[po.supplierId] ?? MOCK_SUPPLIER_SEMEN;
    const supplier = MOCK_SUPPLIER_LIST.find((s) => s.id === supplierId);
    const items: PoItem[] = po.items.map((item, i) => {
      const pIdx = skuIndex(item.sku);
      const received =
        po.status === "received"
          ? item.qty
          : po.status === "partial"
            ? Math.floor(item.qty * 0.6)
            : 0;
      return {
        id: poItemId(n, i + 1),
        po_id: poId(n),
        tenant_id: MOCK_TENANT_ID,
        product_id: pIdx >= 0 ? productId(pIdx) : null,
        product_name: item.name,
        sku: item.sku,
        unit: PRODUCTS[pIdx]?.unit ?? "pcs",
        ordered_qty: item.qty,
        received_qty: received,
        purchase_price: item.price,
        subtotal: item.qty * item.price,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);

    return {
      id: poId(n),
      tenant_id: MOCK_TENANT_ID,
      branch_id: BRANCH_SUDIRMAN,
      po_number: po.number,
      type: "regular" as const,
      sales_order_id: null,
      supplier_id: supplierId,
      delivery_address: null,
      subtotal,
      grand_total: subtotal,
      status: mapPoStatus(po.status),
      expected_date: po.date.slice(0, 10),
      notes: null,
      created_by: MOCK_USER_OWNER,
      created_at: po.date,
      items,
      supplier: supplier ? { name: supplier.name } : undefined,
      sales_order_number: null,
    };
  });
}

export function getSeedMockGoodsReceipts(pos: MockPoWithItems[]): MockGrWithItems[] {
  const receivedPo = pos.find((p) => p.po_number === "PO-2026-0144");
  if (!receivedPo) return [];

  return [
    {
      id: grId(1),
      tenant_id: MOCK_TENANT_ID,
      branch_id: BRANCH_SUDIRMAN,
      gr_number: "GR-2026-0089",
      purchase_order_id: receivedPo.id,
      supplier_id: receivedPo.supplier_id,
      received_by: MOCK_USER_OWNER,
      received_at: new Date(Date.now() - 432000000).toISOString(),
      notes: "Penerimaan lengkap — cat tembok & cat besi",
      items: receivedPo.items.map((item, i) => ({
        id: grItemId(1, i + 1),
        gr_id: grId(1),
        tenant_id: MOCK_TENANT_ID,
        product_id: item.product_id,
        product_name: item.product_name,
        ordered_qty: item.ordered_qty,
        received_qty: item.received_qty,
        unit: item.unit,
      })),
      po_number: receivedPo.po_number,
      po_type: receivedPo.type,
      supplier: receivedPo.supplier,
    },
  ];
}

export function supplierNameOf(id: string): string {
  return MOCK_SUPPLIER_LIST.find((s) => s.id === id)?.name ?? "Supplier";
}

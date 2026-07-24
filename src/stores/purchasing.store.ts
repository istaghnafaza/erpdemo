// =============================================================================
// Purchasing Store — mock PO/GR runtime state (Fase 10).
// =============================================================================

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  getSeedMockPurchaseOrders,
  getSeedMockGoodsReceipts,
  getNextMockPoNumber,
  getNextMockPoId,
  getNextMockPoItemId,
  getNextMockGrNumber,
  getNextMockGrId,
  getNextMockGrItemId,
  supplierNameOf,
  type MockPoItem,
  type MockPoWithItems,
  type MockGrWithItems,
} from "@/lib/mock-purchasing";
import { useInventoryStore } from "@/stores/inventory.store";
import { useSalesOrdersStore } from "@/stores/sales-orders.store";
import {
  hasActiveIndentPoForSoItem,
  indentPoDuplicateError,
} from "@/lib/indent-po-guard";
import {
  findMockIndentPoBySupplier,
  findIndentPoGroupBySupplier,
  upsertIndentPoLineInSo,
} from "@/lib/indent-po-utils";
import type { DbPoStatus, DbPoType, PoItem } from "@/types/database";

export interface CreatePoItemDraft {
  product_id: string | null;
  product_name: string;
  sku: string;
  unit: string;
  ordered_qty: number;
  purchase_price: number;
}

export interface CreatePoDraft {
  tenant_id: string;
  branch_id: string;
  type: DbPoType;
  supplier_id: string;
  sales_order_id: string | null;
  sales_order_number?: string | null;
  so_item_id?: string | null;
  delivery_address: string | null;
  expected_date: string | null;
  notes: string | null;
  created_by: string;
  items: CreatePoItemDraft[];
}

function computePoStatus(items: PoItem[]): DbPoStatus {
  if (items.every((i) => i.received_qty >= i.ordered_qty)) return "received";
  if (items.some((i) => i.received_qty > 0)) return "partial_received";
  return "sent";
}

function mergeIndentPosFromSalesOrders(existing: MockPoWithItems[]): MockPoWithItems[] {
  const knownNumbers = new Set(existing.map((p) => p.po_number));
  const fromSo: MockPoWithItems[] = [];

  for (const so of useSalesOrdersStore.getState().mockOrders) {
    for (const ip of so.indent_pos) {
      if (knownNumbers.has(ip.po_number)) continue;

      const poItems: MockPoItem[] = [];
      let subtotal = 0;
      let grandTotal = 0;

      for (const line of ip.lines) {
        const soItem = so.items.find((i) => i.id === line.so_item_id);
        if (!soItem) continue;

        const purchasePrice =
          soItem.fulfillments.find((f) => f.source === "indent")?.purchase_price_at_time ?? 0;
        const lineSubtotal = line.qty * purchasePrice;
        subtotal += lineSubtotal;
        grandTotal += line.qty * soItem.selling_price;

        poItems.push({
          id: `${ip.id}-item-${line.so_item_id}`,
          po_id: ip.id,
          tenant_id: so.tenant_id,
          product_id: soItem.product_id,
          product_name: soItem.product_name,
          sku: soItem.sku,
          unit: soItem.unit,
          ordered_qty: line.qty,
          received_qty: 0,
          purchase_price: purchasePrice,
          subtotal: lineSubtotal,
          so_item_id: line.so_item_id,
        });
      }

      if (poItems.length === 0) continue;

      fromSo.push({
        id: ip.id,
        tenant_id: so.tenant_id,
        branch_id: so.branch_id,
        po_number: ip.po_number,
        type: "indent",
        sales_order_id: so.id,
        supplier_id: ip.supplier_id,
        delivery_address: so.delivery_address,
        subtotal,
        grand_total: grandTotal,
        status: ip.status === "sent" ? "sent" : "draft",
        expected_date: so.estimated_delivery_date,
        notes: `Indent dari ${so.so_number}`,
        created_by: so.created_by,
        created_at: so.created_at,
        items: poItems,
        supplier: { name: ip.supplier_name },
        sales_order_number: so.so_number,
      });
    }
  }
  return fromSo;
}

const seedPos = getSeedMockPurchaseOrders();

interface PurchasingState {
  mockPurchaseOrders: MockPoWithItems[];
  mockGoodsReceipts: MockGrWithItems[];
  pendingGrPoId: string | null;

  getAllMockPos: () => MockPoWithItems[];
  setPendingGrPoId: (poId: string | null) => void;

  createMockPo: (draft: CreatePoDraft) => { ok: boolean; error?: string; po?: MockPoWithItems };
  sendMockPo: (poId: string) => { ok: boolean; error?: string };
  cancelMockPo: (poId: string) => { ok: boolean; error?: string };

  receiveMockGoods: (
    poId: string,
    userId: string,
    receivedQties: Record<string, number>,
    notes?: string | null,
  ) => { ok: boolean; error?: string; grNumber?: string };

  resetMockPurchasing: () => void;
}

export const usePurchasingStore = create<PurchasingState>()(
  immer((set, get) => ({
    mockPurchaseOrders: seedPos,
    mockGoodsReceipts: getSeedMockGoodsReceipts(seedPos),
    pendingGrPoId: null,

    setPendingGrPoId: (poId) => set({ pendingGrPoId: poId }),

    getAllMockPos: () => {
      const base = get().mockPurchaseOrders;
      return [...mergeIndentPosFromSalesOrders(base), ...base].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },

    createMockPo: (draft) => {
      if (draft.type === "indent") {
        if (!draft.so_item_id) {
          return { ok: false, error: "Pilih baris Sales Order untuk PO indent" };
        }
        if (!draft.sales_order_id) {
          return { ok: false, error: "Referensi Sales Order wajib untuk PO indent" };
        }

        const mockOrders = useSalesOrdersStore.getState().mockOrders;
        const so = mockOrders.find((o) => o.id === draft.sales_order_id);
        const soItem = so?.items.find((i) => i.id === draft.so_item_id);
        if (!so || !soItem) {
          return { ok: false, error: "Baris Sales Order tidak ditemukan" };
        }

        if (
          hasActiveIndentPoForSoItem(
            draft.so_item_id,
            get().mockPurchaseOrders,
            mockOrders,
          )
        ) {
          return { ok: false, error: indentPoDuplicateError(so.so_number) };
        }

        if (draft.items.length !== 1) {
          return { ok: false, error: "PO indent hanya boleh berisi 1 produk sesuai baris SO" };
        }

        const line = draft.items[0];
        if (soItem.product_id && line.product_id !== soItem.product_id) {
          return { ok: false, error: "Produk PO indent harus sama dengan baris SO" };
        }

        const existingStorePo = findMockIndentPoBySupplier(
          get().mockPurchaseOrders,
          draft.sales_order_id,
          draft.supplier_id,
        );
        const existingSoGroup = findIndentPoGroupBySupplier(so, draft.supplier_id);

        const syncIndentPos = (groupId: string, poNumber: string, status: "draft" | "sent") => {
          useSalesOrdersStore.setState((soState) => {
            const soRef = soState.mockOrders.find((o) => o.id === draft.sales_order_id);
            if (soRef) {
              upsertIndentPoLineInSo(
                soRef,
                {
                  id: groupId,
                  po_number: poNumber,
                  sales_order_id: draft.sales_order_id!,
                  supplier_id: draft.supplier_id,
                  supplier_name: supplierNameOf(draft.supplier_id),
                  status,
                },
                draft.so_item_id!,
                line.ordered_qty,
              );
            }
          });
        };

        if (existingStorePo) {
          const lineSubtotal = line.ordered_qty * line.purchase_price;
          const newItem: MockPoItem = {
            id: getNextMockPoItemId(),
            po_id: existingStorePo.id,
            tenant_id: draft.tenant_id,
            product_id: line.product_id,
            product_name: line.product_name,
            sku: line.sku,
            unit: line.unit,
            ordered_qty: line.ordered_qty,
            received_qty: 0,
            purchase_price: line.purchase_price,
            subtotal: lineSubtotal,
            so_item_id: draft.so_item_id,
          };

          set((s) => {
            const po = s.mockPurchaseOrders.find((p) => p.id === existingStorePo.id);
            if (po) {
              po.items.push(newItem);
              po.subtotal += lineSubtotal;
              po.grand_total += lineSubtotal;
            }
          });
          syncIndentPos(
            existingStorePo.id,
            existingStorePo.po_number,
            existingStorePo.status === "sent" ? "sent" : "draft",
          );
          return { ok: true, po: existingStorePo };
        }

        if (existingSoGroup) {
          syncIndentPos(
            existingSoGroup.id,
            existingSoGroup.po_number,
            existingSoGroup.status,
          );
          const merged = get().getAllMockPos().find((p) => p.id === existingSoGroup.id);
          return { ok: true, po: merged };
        }
      }

      const id = getNextMockPoId();
      const subtotal = draft.items.reduce(
        (s, i) => s + i.ordered_qty * i.purchase_price,
        0,
      );
      const po: MockPoWithItems = {
        id,
        tenant_id: draft.tenant_id,
        branch_id: draft.branch_id,
        po_number: getNextMockPoNumber(draft.type),
        type: draft.type,
        sales_order_id: draft.sales_order_id,
        supplier_id: draft.supplier_id,
        delivery_address: draft.delivery_address,
        subtotal,
        grand_total: subtotal,
        status: "draft",
        expected_date: draft.expected_date,
        notes: draft.notes,
        created_by: draft.created_by,
        created_at: new Date().toISOString(),
        items: draft.items.map((item) => ({
          id: getNextMockPoItemId(),
          po_id: id,
          tenant_id: draft.tenant_id,
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.sku,
          unit: item.unit,
          ordered_qty: item.ordered_qty,
          received_qty: 0,
          purchase_price: item.purchase_price,
          subtotal: item.ordered_qty * item.purchase_price,
          so_item_id:
            draft.type === "indent" && draft.items.length === 1
              ? draft.so_item_id ?? null
              : null,
        })),
        supplier: { name: supplierNameOf(draft.supplier_id) },
        sales_order_number: draft.sales_order_number ?? null,
        so_item_id: draft.type === "indent" ? draft.so_item_id ?? null : null,
      };

      set((s) => {
        s.mockPurchaseOrders.unshift(po);

        if (draft.type === "indent" && draft.sales_order_id && draft.so_item_id) {
          useSalesOrdersStore.setState((soState) => {
            const soRef = soState.mockOrders.find((o) => o.id === draft.sales_order_id);
            if (!soRef) return;
            upsertIndentPoLineInSo(
              soRef,
              {
                id: po.id,
                po_number: po.po_number,
                sales_order_id: draft.sales_order_id!,
                supplier_id: draft.supplier_id,
                supplier_name: supplierNameOf(draft.supplier_id),
                status: "draft",
              },
              draft.so_item_id!,
              draft.items[0]?.ordered_qty ?? 0,
            );
          });
        }
      });
      return { ok: true, po };
    },

    sendMockPo: (poId) => {
      const all = get().getAllMockPos();
      const po = all.find((p) => p.id === poId);
      if (!po) return { ok: false, error: "PO tidak ditemukan" };
      if (po.status !== "draft") return { ok: false, error: "PO sudah dikirim" };

      set((s) => {
        const p = s.mockPurchaseOrders.find((x) => x.id === poId);
        if (p) {
          p.status = "sent";
          return;
        }
        if (po.type === "indent") {
          useSalesOrdersStore.setState((so) => {
            for (const o of so.mockOrders) {
              const ip = o.indent_pos.find((x) => x.id === poId);
              if (ip) ip.status = "sent";
            }
          });
        }
      });
      return { ok: true };
    },

    cancelMockPo: (poId) => {
      const po = get().getAllMockPos().find((p) => p.id === poId);
      if (!po) return { ok: false, error: "PO tidak ditemukan" };
      if (po.status === "received") return { ok: false, error: "PO sudah diterima" };

      set((s) => {
        const p = s.mockPurchaseOrders.find((x) => x.id === poId);
        if (p) p.status = "cancelled";
      });
      return { ok: true };
    },

    receiveMockGoods: (poId, userId, receivedQties, notes) => {
      const all = get().getAllMockPos();
      const po = all.find((p) => p.id === poId);
      if (!po) return { ok: false, error: "PO tidak ditemukan" };
      if (po.status === "draft" || po.status === "cancelled") {
        return { ok: false, error: "Kirim PO ke supplier terlebih dahulu" };
      }

      const isIndent = po.type === "indent";
      let totalReceived = 0;

      for (const item of po.items) {
        const qty = receivedQties[item.id] ?? 0;
        if (qty <= 0) continue;
        const remaining = item.ordered_qty - item.received_qty;
        if (qty > remaining) {
          return { ok: false, error: `Qty ${item.product_name} melebihi sisa order` };
        }
        totalReceived += qty;
      }

      if (totalReceived <= 0) return { ok: false, error: "Isi qty penerimaan minimal 1 item" };

      const grNumber = getNextMockGrNumber();
      const grId = getNextMockGrId();

      set((s) => {
        let poRef = s.mockPurchaseOrders.find((x) => x.id === poId);
        if (!poRef) {
          poRef = { ...po, items: po.items.map((i) => ({ ...i })) };
          s.mockPurchaseOrders.unshift(poRef);
        }

        for (const item of poRef.items) {
          const qty = receivedQties[item.id] ?? 0;
          if (qty <= 0) continue;

          item.received_qty += qty;

          if (!isIndent && item.product_id) {
            const key = `${poRef.branch_id}:${item.product_id}`;
            useInventoryStore.setState((inv) => {
              inv.mockStockAdjustments[key] = (inv.mockStockAdjustments[key] ?? 0) + qty;
            });
          } else if (isIndent && item.so_item_id) {
            useSalesOrdersStore.getState().confirmIndentGrReceived(item.so_item_id, qty);
          }
        }

        poRef.status = computePoStatus(poRef.items);

        s.mockGoodsReceipts.unshift({
          id: grId,
          tenant_id: poRef.tenant_id,
          branch_id: poRef.branch_id,
          gr_number: grNumber,
          purchase_order_id: poRef.id,
          supplier_id: poRef.supplier_id,
          received_by: userId,
          received_at: new Date().toISOString(),
          notes: notes ?? null,
          items: poRef.items
            .filter((i) => (receivedQties[i.id] ?? 0) > 0)
            .map((i) => ({
              id: getNextMockGrItemId(),
              gr_id: grId,
              tenant_id: poRef.tenant_id,
              product_id: i.product_id,
              product_name: i.product_name,
              ordered_qty: i.ordered_qty,
              received_qty: receivedQties[i.id] ?? 0,
              unit: i.unit,
            })),
          po_number: poRef.po_number,
          po_type: poRef.type,
          supplier: poRef.supplier,
        });
      });

      return { ok: true, grNumber };
    },

    resetMockPurchasing: () => {
      const pos = getSeedMockPurchaseOrders();
      set({
        mockPurchaseOrders: pos,
        mockGoodsReceipts: getSeedMockGoodsReceipts(pos),
        pendingGrPoId: null,
      });
    },
  })),
);

export function poStatusLabel(status: DbPoStatus): string {
  const map: Record<DbPoStatus, string> = {
    draft: "Draft",
    sent: "Terkirim",
    partial_received: "Sebagian Diterima",
    received: "Diterima",
    cancelled: "Dibatalkan",
  };
  return map[status];
}

export function poStatusKind(status: DbPoStatus) {
  const map: Record<
    DbPoStatus,
    "draft" | "sent" | "partial_received" | "received" | "cancelled"
  > = {
    draft: "draft",
    sent: "sent",
    partial_received: "partial_received",
    received: "received",
    cancelled: "cancelled",
  };
  return map[status];
}

export function poTypeLabel(type: DbPoType): string {
  return type === "indent" ? "Indent (SO)" : "Reguler";
}

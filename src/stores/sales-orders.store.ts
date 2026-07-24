// =============================================================================
// Sales Orders Store — mock-session runtime state (Fase 9).
// Real tenants use src/lib/api/sales-orders.ts directly via useSalesOrders.
// =============================================================================

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  getSeedMockSalesOrders,
  getNextMockSoNumber,
  getNextMockSoId,
  getNextMockSoItemId,
  getNextMockFulfillmentId,
  getNextMockIndentPoNumber,
  getNextMockInvoiceNumber,
  MOCK_SUPPLIER_SEMEN,
  MOCK_SUPPLIERS,
  type MockSalesOrderWithDetails,
  type MockSalesOrderItem,
} from "@/lib/mock-sales-orders";
import { useInventoryStore } from "@/stores/inventory.store";
import { usePurchasingStore } from "@/stores/purchasing.store";
import { hasActiveIndentPoForSoItem, indentPoDuplicateError } from "@/lib/indent-po-guard";
import {
  findIndentPoGroupBySupplier,
  indentQtyForSoItem,
  upsertIndentPoLineInSo,
} from "@/lib/indent-po-utils";
import type { SalesOrderItem, DbSoStatus, DbSoItemStatus } from "@/types/database";

export interface CreateSoItemDraft {
  product_id: string;
  product_name: string;
  sku: string;
  unit: string;
  qty: number;
  selling_price: number;
  discount: number;
}

export interface CreateSoDraft {
  tenant_id: string;
  branch_id: string;
  customer_id: string | null;
  customer_name: string;
  delivery_address: string | null;
  discount_amount: number;
  down_payment: number;
  estimated_delivery_date: string | null;
  notes: string | null;
  created_by: string;
  items: CreateSoItemDraft[];
}

export interface CreateSoFromPosDraft {
  tenant_id: string;
  branch_id: string;
  customer_id: string | null;
  customer_name: string;
  delivery_address: string | null;
  discount_amount: number;
  created_by: string;
  pos_transaction_id: string;
  pos_transaction_number: string;
  down_payment: number;
  items: CreateSoItemDraft[];
}

export interface UpdateSoItemDraft extends CreateSoItemDraft {
  /** Id baris SO existing — kosong untuk baris baru */
  id?: string | null;
}

export interface UpdateSoDraft {
  customer_id: string | null;
  customer_name: string;
  delivery_address: string | null;
  discount_amount: number;
  down_payment: number;
  estimated_delivery_date: string | null;
  notes: string | null;
  items: UpdateSoItemDraft[];
}

function isSoEditable(order: MockSalesOrderWithDetails): boolean {
  if (order.ar_invoice_number) return false;
  return (
    order.status === "draft" ||
    order.status === "confirmed" ||
    order.status === "partial_delivered"
  );
}

function itemIsLocked(item: MockSalesOrderItem, order: MockSalesOrderWithDetails): boolean {
  if (item.delivered_qty > 0 || item.fulfillments.length > 0) return true;
  return hasActiveIndentPoForSoItem(
    item.id,
    usePurchasingStore.getState().mockPurchaseOrders,
    [order],
  );
}

function computeSoStatus(items: MockSalesOrderItem[]): DbSoStatus {
  if (items.every((i) => i.status === "fulfilled")) return "completed";
  if (items.some((i) => i.delivered_qty > 0)) return "partial_delivered";
  return "confirmed";
}

function computeItemStatus(item: SalesOrderItem): DbSoItemStatus {
  if (item.delivered_qty >= item.qty) return "fulfilled";
  if (item.delivered_qty > 0) return "partial";
  return "pending";
}

function paymentStatusOf(grandTotal: number, downPayment: number) {
  if (downPayment >= grandTotal) return "paid" as const;
  if (downPayment > 0) return "partial" as const;
  return "unpaid" as const;
}

interface SalesOrdersState {
  mockOrders: MockSalesOrderWithDetails[];

  createMockOrder: (draft: CreateSoDraft) => MockSalesOrderWithDetails;
  createMockOrderFromPosCheckout: (draft: CreateSoFromPosDraft) => MockSalesOrderWithDetails;
  updateMockOrder: (soId: string, draft: UpdateSoDraft) => { ok: boolean; error?: string };
  confirmMockOrder: (soId: string) => { ok: boolean; error?: string };
  cancelMockOrder: (soId: string) => { ok: boolean; error?: string };

  processFulfillment: (
    soId: string,
    soItemId: string,
    stockQty: number,
    indentQty: number,
    supplierId?: string,
  ) => { ok: boolean; error?: string };

  convertToInvoice: (soId: string) => { ok: boolean; error?: string; invoiceNumber?: string };

  /** GR indent — barang langsung ke pelanggan, stok toko tidak berubah (Fase 10). */
  confirmIndentGrReceived: (soItemId: string, qty: number) => { ok: boolean; error?: string };

  resetMockSalesOrders: () => void;
}

export const useSalesOrdersStore = create<SalesOrdersState>()(
  immer((set, get) => ({
    mockOrders: getSeedMockSalesOrders(),

    createMockOrder: (draft) => {
      const id = getNextMockSoId();
      const subtotal = draft.items.reduce(
        (s, i) => s + i.qty * i.selling_price - i.discount,
        0,
      );
      const grandTotal = Math.max(0, subtotal - draft.discount_amount);

      const order: MockSalesOrderWithDetails = {
        id,
        tenant_id: draft.tenant_id,
        branch_id: draft.branch_id,
        so_number: getNextMockSoNumber(),
        customer_id: draft.customer_id,
        customer_name: draft.customer_name,
        delivery_address: draft.delivery_address,
        subtotal,
        discount_amount: draft.discount_amount,
        grand_total: grandTotal,
        down_payment: draft.down_payment,
        remaining_payment: Math.max(0, grandTotal - draft.down_payment),
        status: "draft",
        payment_status: paymentStatusOf(grandTotal, draft.down_payment),
        estimated_delivery_date: draft.estimated_delivery_date,
        notes: draft.notes,
        created_by: draft.created_by,
        created_at: new Date().toISOString(),
        customer: { name: draft.customer_name, phone: null },
        indent_pos: [],
        ar_invoice_number: null,
        source: "manual",
        pos_transaction_id: null,
        pos_transaction_number: null,
        items: draft.items.map((item) => ({
          id: getNextMockSoItemId(id),
          so_id: id,
          tenant_id: draft.tenant_id,
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.sku,
          unit: item.unit,
          qty: item.qty,
          selling_price: item.selling_price,
          discount: item.discount,
          subtotal: item.qty * item.selling_price - item.discount,
          delivered_qty: 0,
          status: "pending" as const,
          fulfillments: [],
        })),
      };

      set((s) => {
        s.mockOrders.unshift(order);
      });
      return order;
    },

    createMockOrderFromPosCheckout: (draft) => {
      const id = getNextMockSoId();
      const subtotal = draft.items.reduce(
        (s, i) => s + i.qty * i.selling_price - i.discount,
        0,
      );
      const grandTotal = Math.max(0, subtotal - draft.discount_amount);
      const downPayment = Math.min(grandTotal, Math.max(0, draft.down_payment));
      const remaining = Math.max(0, grandTotal - downPayment);

      const order: MockSalesOrderWithDetails = {
        id,
        tenant_id: draft.tenant_id,
        branch_id: draft.branch_id,
        so_number: getNextMockSoNumber(),
        customer_id: draft.customer_id,
        customer_name: draft.customer_name,
        delivery_address: draft.delivery_address,
        subtotal,
        discount_amount: draft.discount_amount,
        grand_total: grandTotal,
        down_payment: downPayment,
        remaining_payment: remaining,
        status: "confirmed",
        payment_status: paymentStatusOf(grandTotal, downPayment),
        estimated_delivery_date: null,
        notes: `Dibuat otomatis dari checkout POS ${draft.pos_transaction_number}`,
        created_by: draft.created_by,
        created_at: new Date().toISOString(),
        customer: { name: draft.customer_name, phone: null },
        indent_pos: [],
        ar_invoice_number: null,
        source: "pos",
        pos_transaction_id: draft.pos_transaction_id,
        pos_transaction_number: draft.pos_transaction_number,
        items: draft.items.map((item) => ({
          id: getNextMockSoItemId(id),
          so_id: id,
          tenant_id: draft.tenant_id,
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.sku,
          unit: item.unit,
          qty: item.qty,
          selling_price: item.selling_price,
          discount: item.discount,
          subtotal: item.qty * item.selling_price - item.discount,
          delivered_qty: 0,
          status: "pending" as const,
          fulfillments: [],
        })),
      };

      set((s) => {
        s.mockOrders.unshift(order);
      });
      return order;
    },

    updateMockOrder: (soId, draft) => {
      const order = get().mockOrders.find((o) => o.id === soId);
      if (!order) return { ok: false, error: "Sales Order tidak ditemukan" };
      if (!isSoEditable(order)) {
        return { ok: false, error: "SO tidak bisa diedit pada status ini" };
      }
      if (draft.items.length === 0) {
        return { ok: false, error: "Minimal 1 item di SO" };
      }

      const mockPurchaseOrders = usePurchasingStore.getState().mockPurchaseOrders;
      const draftExistingIds = new Set(
        draft.items.map((i) => i.id).filter((id): id is string => Boolean(id)),
      );

      for (const existing of order.items) {
        if (draftExistingIds.has(existing.id)) continue;

        if (existing.delivered_qty > 0 || existing.fulfillments.length > 0) {
          return {
            ok: false,
            error: `Baris "${existing.product_name}" sudah diproses — tidak bisa dihapus`,
          };
        }
        if (hasActiveIndentPoForSoItem(existing.id, mockPurchaseOrders, get().mockOrders)) {
          return {
            ok: false,
            error: `Baris "${existing.product_name}" punya PO indent — tidak bisa dihapus`,
          };
        }
      }

      for (const itemDraft of draft.items) {
        if (!itemDraft.id) continue;

        const existing = order.items.find((i) => i.id === itemDraft.id);
        if (!existing) return { ok: false, error: "Baris SO tidak ditemukan" };

        if (existing.product_id !== itemDraft.product_id) {
          if (existing.delivered_qty > 0 || existing.fulfillments.length > 0) {
            return {
              ok: false,
              error: `Produk "${existing.product_name}" tidak bisa diganti — sudah ada fulfillment`,
            };
          }
          if (hasActiveIndentPoForSoItem(existing.id, mockPurchaseOrders, get().mockOrders)) {
            return {
              ok: false,
              error: `Produk "${existing.product_name}" tidak bisa diganti — sudah ada PO indent`,
            };
          }
        }

        const minQty = Math.max(existing.delivered_qty, indentQtyForSoItem(order, existing.id));
        if (itemDraft.qty < minQty) {
          return {
            ok: false,
            error: `Qty "${existing.product_name}" minimal ${minQty} (sudah terkirim / PO indent)`,
          };
        }
      }

      const newProductIds = draft.items
        .filter((i) => !i.id)
        .map((i) => i.product_id);
      const duplicateNew = newProductIds.find(
        (pid, idx) => newProductIds.indexOf(pid) !== idx,
      );
      if (duplicateNew) {
        return { ok: false, error: "Produk duplikat pada baris baru" };
      }

      const allProductIds = draft.items.map((i) => i.product_id);
      if (new Set(allProductIds).size !== allProductIds.length) {
        return { ok: false, error: "Produk duplikat dalam SO" };
      }

      set((s) => {
        const o = s.mockOrders.find((x) => x.id === soId);
        if (!o) return;

        o.customer_id = draft.customer_id;
        o.customer_name = draft.customer_name;
        o.delivery_address = draft.delivery_address;
        o.discount_amount = draft.discount_amount;
        o.down_payment = draft.down_payment;
        o.estimated_delivery_date = draft.estimated_delivery_date;
        o.notes = draft.notes;
        if (o.customer) o.customer.name = draft.customer_name;

        const nextItems: MockSalesOrderItem[] = [];

        for (const itemDraft of draft.items) {
          if (itemDraft.id) {
            const existing = o.items.find((i) => i.id === itemDraft.id);
            if (!existing) continue;

            existing.product_id = itemDraft.product_id;
            existing.product_name = itemDraft.product_name;
            existing.sku = itemDraft.sku;
            existing.unit = itemDraft.unit;
            existing.qty = itemDraft.qty;
            existing.selling_price = itemDraft.selling_price;
            existing.discount = itemDraft.discount;
            existing.subtotal = itemDraft.qty * itemDraft.selling_price - itemDraft.discount;
            existing.status = computeItemStatus(existing);
            nextItems.push(existing);
            continue;
          }

          nextItems.push({
            id: getNextMockSoItemId(soId),
            so_id: soId,
            tenant_id: o.tenant_id,
            product_id: itemDraft.product_id,
            product_name: itemDraft.product_name,
            sku: itemDraft.sku,
            unit: itemDraft.unit,
            qty: itemDraft.qty,
            selling_price: itemDraft.selling_price,
            discount: itemDraft.discount,
            subtotal: itemDraft.qty * itemDraft.selling_price - itemDraft.discount,
            delivered_qty: 0,
            status: "pending",
            fulfillments: [],
          });
        }

        o.items = nextItems;
        o.subtotal = nextItems.reduce((sum, i) => sum + i.subtotal, 0);
        o.grand_total = Math.max(0, o.subtotal - o.discount_amount);
        o.remaining_payment = Math.max(0, o.grand_total - o.down_payment);
        o.payment_status = paymentStatusOf(o.grand_total, o.down_payment);
        if (o.status !== "draft") {
          o.status = computeSoStatus(o.items);
        }
      });

      return { ok: true };
    },

    confirmMockOrder: (soId) => {
      const order = get().mockOrders.find((o) => o.id === soId);
      if (!order) return { ok: false, error: "Sales Order tidak ditemukan" };
      if (order.status !== "draft") return { ok: false, error: "SO sudah dikonfirmasi" };

      set((s) => {
        const o = s.mockOrders.find((x) => x.id === soId);
        if (o) o.status = "confirmed";
      });
      return { ok: true };
    },

    cancelMockOrder: (soId) => {
      const order = get().mockOrders.find((o) => o.id === soId);
      if (!order) return { ok: false, error: "Sales Order tidak ditemukan" };
      if (order.status === "completed" || order.status === "cancelled") {
        return { ok: false, error: "SO tidak bisa dibatalkan" };
      }

      set((s) => {
        const o = s.mockOrders.find((x) => x.id === soId);
        if (o) o.status = "cancelled";
      });
      return { ok: true };
    },

    processFulfillment: (soId, soItemId, stockQty, indentQty, supplierId) => {
      const order = get().mockOrders.find((o) => o.id === soId);
      if (!order) return { ok: false, error: "Sales Order tidak ditemukan" };
      if (order.status === "draft" || order.status === "cancelled") {
        return { ok: false, error: "Konfirmasi SO terlebih dahulu" };
      }

      const item = order.items.find((i) => i.id === soItemId);
      if (!item) return { ok: false, error: "Item tidak ditemukan" };

      const remaining = item.qty - item.delivered_qty;
      const totalFulfill = stockQty + indentQty;
      if (totalFulfill <= 0) return { ok: false, error: "Qty fulfillment minimal 1" };
      if (totalFulfill > remaining) {
        return { ok: false, error: `Maksimal ${remaining} unit tersisa` };
      }
      if (indentQty > 0 && !supplierId) {
        return { ok: false, error: "Pilih supplier untuk item indent" };
      }
      if (
        indentQty > 0 &&
        hasActiveIndentPoForSoItem(
          soItemId,
          usePurchasingStore.getState().mockPurchaseOrders,
          get().mockOrders,
        )
      ) {
        return { ok: false, error: indentPoDuplicateError(order.so_number) };
      }

      set((s) => {
        const o = s.mockOrders.find((x) => x.id === soId);
        if (!o) return;
        const it = o.items.find((i) => i.id === soItemId);
        if (!it || !it.product_id) return;

        if (stockQty > 0) {
          const key = `${o.branch_id}:${it.product_id}`;
          useInventoryStore.setState((inv) => {
            inv.mockStockAdjustments[key] = (inv.mockStockAdjustments[key] ?? 0) - stockQty;
          });
          it.fulfillments.push({
            id: getNextMockFulfillmentId(),
            so_item_id: soItemId,
            tenant_id: o.tenant_id,
            source: "stock",
            qty: stockQty,
            purchase_order_id: null,
            supplier_id: null,
            purchase_price_at_time: 0,
            status: "delivered",
          });
        }

        if (indentQty > 0) {
          const supplier = MOCK_SUPPLIERS.find((sup) => sup.id === supplierId) ?? MOCK_SUPPLIERS[0];
          const supplierIdVal = supplierId ?? MOCK_SUPPLIER_SEMEN;
          const existingGroup = findIndentPoGroupBySupplier(o, supplierIdVal);

          let groupId: string;

          if (existingGroup) {
            groupId = existingGroup.id;
            upsertIndentPoLineInSo(
              o,
              {
                id: existingGroup.id,
                po_number: existingGroup.po_number,
                sales_order_id: soId,
                supplier_id: supplierIdVal,
                supplier_name: supplier.name,
                status: existingGroup.status,
              },
              soItemId,
              indentQty,
            );
          } else {
            groupId = getNextMockFulfillmentId();
            upsertIndentPoLineInSo(
              o,
              {
                id: groupId,
                po_number: getNextMockIndentPoNumber(),
                sales_order_id: soId,
                supplier_id: supplierIdVal,
                supplier_name: supplier.name,
                status: "draft",
              },
              soItemId,
              indentQty,
            );
          }

          it.fulfillments.push({
            id: getNextMockFulfillmentId(),
            so_item_id: soItemId,
            tenant_id: o.tenant_id,
            source: "indent",
            qty: indentQty,
            purchase_order_id: groupId,
            supplier_id: supplierIdVal,
            purchase_price_at_time: 0,
            status: "planned",
          });
        }

        it.delivered_qty += totalFulfill;
        it.status = computeItemStatus(it);
        o.status = computeSoStatus(o.items);
      });

      return { ok: true };
    },

    convertToInvoice: (soId) => {
      const order = get().mockOrders.find((o) => o.id === soId);
      if (!order) return { ok: false, error: "Sales Order tidak ditemukan" };
      if (order.status !== "completed") {
        return { ok: false, error: "SO belum selesai — selesaikan fulfillment dulu" };
      }
      if (order.ar_invoice_number) {
        return { ok: false, error: `Sudah di-invoice: ${order.ar_invoice_number}` };
      }

      const invoiceNumber = getNextMockInvoiceNumber();
      set((s) => {
        const o = s.mockOrders.find((x) => x.id === soId);
        if (o) o.ar_invoice_number = invoiceNumber;
      });
      return { ok: true, invoiceNumber };
    },

    confirmIndentGrReceived: (soItemId, qty) => {
      let found = false;
      set((s) => {
        for (const o of s.mockOrders) {
          const item = o.items.find((i) => i.id === soItemId);
          if (!item) continue;
          found = true;

          const indentFul = item.fulfillments.find(
            (f) => f.source === "indent" && f.status !== "delivered",
          );
          if (indentFul) {
            indentFul.status = "delivered";
          }

          const indentGroup = o.indent_pos.find((p) =>
            p.lines.some((l) => l.so_item_id === soItemId),
          );
          if (indentGroup) indentGroup.status = "sent";

          item.delivered_qty = Math.min(item.qty, item.delivered_qty + qty);
          item.status = computeItemStatus(item);
          o.status = computeSoStatus(o.items);
          break;
        }
      });
      if (!found) return { ok: false, error: "Item SO tidak ditemukan" };
      return { ok: true };
    },

    resetMockSalesOrders: () => set({ mockOrders: getSeedMockSalesOrders() }),
  })),
);

export function canEditSalesOrder(order: MockSalesOrderWithDetails): boolean {
  if (order.source === "pos") return false;
  return isSoEditable(order);
}

export function getSoItemEditMeta(item: MockSalesOrderItem, order: MockSalesOrderWithDetails) {
  const locked = itemIsLocked(item, order);
  const minQty = Math.max(item.delivered_qty, indentQtyForSoItem(order, item.id));
  return { locked, minQty, canRemove: !locked };
}

export function soStatusLabel(status: DbSoStatus): string {
  const map: Record<DbSoStatus, string> = {
    draft: "Draft",
    confirmed: "Dikonfirmasi",
    partial_delivered: "Sebagian Dikirim",
    completed: "Selesai",
    cancelled: "Dibatalkan",
  };
  return map[status];
}

export function soStatusKind(status: DbSoStatus) {
  const map: Record<
    DbSoStatus,
    "draft" | "confirmed" | "partial_received" | "completed" | "cancelled"
  > = {
    draft: "draft",
    confirmed: "confirmed",
    partial_delivered: "partial_received",
    completed: "completed",
    cancelled: "cancelled",
  };
  return map[status];
}

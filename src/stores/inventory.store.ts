// =============================================================================
// Inventory Store — mock-session runtime state for stock adjustments,
// movements, transfers, and product edits (Fase 8).
//
// Real tenants bypass this store — hooks call src/lib/api/* directly.
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import {
  getSeedMockMovements,
  getSeedMockTransfers,
  getNextMockMovementId,
  getNextMockTransferId,
  getNextMockTransferItemId,
  getNextMockTransferNumber,
  type MockTransferWithItems,
} from "@/lib/mock-inventory";
import { MOCK_TENANT_ID } from "@/stores/auth.store";
import type { OpnameItem, StockMovement, StockTransferItem } from "@/types/database";

export type StockStatusFilter = "all" | "critical" | "low" | "normal" | "empty";

export interface MockProductOverride {
  sku?: string;
  barcode?: string | null;
  name?: string;
  categoryName?: string;
  unit?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  reorderPoint?: number;
  warehouseLocation?: string;
  initialStock?: number;
  legacyStock?: number;
  isActive?: boolean;
}

interface InventoryState {
  /** Branch-specific stock delta from opname / manual adjustments */
  mockStockAdjustments: Record<string, number>;
  mockMovements: StockMovement[];
  mockTransfers: MockTransferWithItems[];
  mockDeactivatedIds: Record<string, boolean>;
  mockProductOverrides: Record<string, MockProductOverride>;
  pendingOpnameApproval: boolean;

  applyOpnameAdjustments: (
    branchId: string,
    userId: string,
    reference: string,
    items: OpnameItem[],
  ) => void;
  requestOpnameApproval: () => void;
  clearOpnameApproval: () => void;

  addMockMovement: (movement: Omit<StockMovement, "id">) => void;

  createMockTransfer: (
    transfer: Omit<MockTransferWithItems, "id" | "transfer_number" | "items" | "created_at">,
    items: Omit<StockTransferItem, "id" | "transfer_id" | "tenant_id">[],
  ) => MockTransferWithItems;
  sendMockTransfer: (transferId: string, userId: string) => { ok: boolean; error?: string };
  receiveMockTransfer: (
    transferId: string,
    userId: string,
    receivedQties?: Record<string, number>,
  ) => { ok: boolean; error?: string };
  cancelMockTransfer: (transferId: string, userId: string) => { ok: boolean; error?: string };

  deactivateMockProduct: (productId: string) => void;
  updateMockProduct: (productId: string, updates: MockProductOverride) => void;
  addMockProduct: (productId: string, data: MockProductOverride) => void;

  resetMockInventory: () => void;
}

function adjKey(branchId: string, productId: string): string {
  return `${branchId}:${productId}`;
}

const seedMovements = getSeedMockMovements();
const seedTransfers = getSeedMockTransfers();

export const useInventoryStore = create<InventoryState>()(
  persist(
    immer((set, get) => ({
    mockStockAdjustments: {},
    mockMovements: seedMovements,
    mockTransfers: seedTransfers,
    mockDeactivatedIds: {},
    mockProductOverrides: {},
    pendingOpnameApproval: false,

    applyOpnameAdjustments: (branchId, userId, reference, items) => {
      set((s) => {
        for (const item of items) {
          if (item.discrepancy === 0) continue;
          const key = adjKey(branchId, item.product_id);
          s.mockStockAdjustments[key] = (s.mockStockAdjustments[key] ?? 0) + item.discrepancy;

          s.mockMovements.unshift({
            id: getNextMockMovementId(),
            tenant_id: MOCK_TENANT_ID,
            branch_id: branchId,
            product_id: item.product_id,
            type: "opname",
            stock_source: item.stock_source,
            qty: Math.abs(item.discrepancy),
            qty_before: item.system_stock,
            qty_after: item.actual_stock,
            reference,
            notes: item.notes,
            user_id: userId,
            created_at: new Date().toISOString(),
          });
        }
        s.pendingOpnameApproval = false;
      });
    },

    requestOpnameApproval: () => set({ pendingOpnameApproval: true }),
    clearOpnameApproval: () => set({ pendingOpnameApproval: false }),

    addMockMovement: (movement) =>
      set((s) => {
        s.mockMovements.unshift({ ...movement, id: getNextMockMovementId() });
      }),

    createMockTransfer: (transfer, items) => {
      const id = getNextMockTransferId();
      const tf: MockTransferWithItems = {
        ...transfer,
        id,
        transfer_number: getNextMockTransferNumber(),
        status: "draft",
        sent_at: null,
        received_at: null,
        confirmed_by: null,
        created_at: new Date().toISOString(),
        items: items.map((item) => ({
          ...item,
          id: getNextMockTransferItemId(id),
          transfer_id: id,
          tenant_id: transfer.tenant_id,
          received_qty: 0,
        })),
      };
      set((s) => {
        s.mockTransfers.unshift(tf);
      });
      return tf;
    },

    sendMockTransfer: (transferId, userId) => {
      const state = get();
      const tf = state.mockTransfers.find((t) => t.id === transferId);
      if (!tf) return { ok: false, error: "Transfer tidak ditemukan" };
      if (tf.status !== "draft") return { ok: false, error: "Transfer sudah dikirim atau dibatalkan" };

      set((s) => {
        const t = s.mockTransfers.find((x) => x.id === transferId);
        if (!t) return;
        for (const item of t.items) {
          const key = adjKey(t.from_branch_id, item.product_id);
          s.mockStockAdjustments[key] = (s.mockStockAdjustments[key] ?? 0) - item.sent_qty;
          s.mockMovements.unshift({
            id: getNextMockMovementId(),
            tenant_id: t.tenant_id,
            branch_id: t.from_branch_id,
            product_id: item.product_id,
            type: "transfer_out",
            stock_source: "verified",
            qty: item.sent_qty,
            qty_before: 0,
            qty_after: 0,
            reference: t.transfer_number,
            notes: `Transfer ke ${t.to_branch?.name ?? "cabang tujuan"}`,
            user_id: userId,
            created_at: new Date().toISOString(),
          });
        }
        t.status = "sent";
        t.sent_at = new Date().toISOString();
      });
      return { ok: true };
    },

    receiveMockTransfer: (transferId, userId, receivedQties = {}) => {
      const state = get();
      const tf = state.mockTransfers.find((t) => t.id === transferId);
      if (!tf) return { ok: false, error: "Transfer tidak ditemukan" };
      if (tf.status !== "sent") return { ok: false, error: "Transfer belum dikirim" };

      set((s) => {
        const t = s.mockTransfers.find((x) => x.id === transferId);
        if (!t) return;
        for (const item of t.items) {
          const qty = receivedQties[item.id] ?? item.sent_qty;
          item.received_qty = qty;
          const key = adjKey(t.to_branch_id, item.product_id);
          s.mockStockAdjustments[key] = (s.mockStockAdjustments[key] ?? 0) + qty;
          s.mockMovements.unshift({
            id: getNextMockMovementId(),
            tenant_id: t.tenant_id,
            branch_id: t.to_branch_id,
            product_id: item.product_id,
            type: "transfer_in",
            stock_source: "verified",
            qty,
            qty_before: 0,
            qty_after: 0,
            reference: t.transfer_number,
            notes: `Transfer dari ${t.from_branch?.name ?? "cabang asal"}`,
            user_id: userId,
            created_at: new Date().toISOString(),
          });
        }
        t.status = "received";
        t.received_at = new Date().toISOString();
        t.confirmed_by = userId;
      });
      return { ok: true };
    },

    cancelMockTransfer: (transferId, userId) => {
      const state = get();
      const tf = state.mockTransfers.find((t) => t.id === transferId);
      if (!tf) return { ok: false, error: "Transfer tidak ditemukan" };
      if (tf.status === "received" || tf.status === "cancelled") {
        return { ok: false, error: "Transfer tidak bisa dibatalkan" };
      }

      set((s) => {
        const t = s.mockTransfers.find((x) => x.id === transferId);
        if (!t) return;
        if (t.status === "sent") {
          for (const item of t.items) {
            const key = adjKey(t.from_branch_id, item.product_id);
            s.mockStockAdjustments[key] = (s.mockStockAdjustments[key] ?? 0) + item.sent_qty;
          }
        }
        t.status = "cancelled";
        void userId;
      });
      return { ok: true };
    },

    deactivateMockProduct: (productId) =>
      set((s) => {
        s.mockDeactivatedIds[productId] = true;
        s.mockProductOverrides[productId] = {
          ...s.mockProductOverrides[productId],
          isActive: false,
        };
      }),

    updateMockProduct: (productId, updates) =>
      set((s) => {
        s.mockProductOverrides[productId] = { ...s.mockProductOverrides[productId], ...updates };
      }),

    addMockProduct: (productId, data) =>
      set((s) => {
        s.mockProductOverrides[productId] = data;
        s.mockDeactivatedIds[productId] = false;
      }),

    resetMockInventory: () =>
      set({
        mockStockAdjustments: {},
        mockMovements: getSeedMockMovements(),
        mockTransfers: getSeedMockTransfers(),
        mockDeactivatedIds: {},
        mockProductOverrides: {},
        pendingOpnameApproval: false,
      }),
    })),
    {
      name: "ses-inventory",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mockStockAdjustments: state.mockStockAdjustments,
        mockProductOverrides: state.mockProductOverrides,
        mockDeactivatedIds: state.mockDeactivatedIds,
        mockMovements: state.mockMovements,
      }),
    },
  ),
);

/** Compute stock status for filter/display */
export function inventoryStockStatus(
  stock: number,
  reorderPoint: number,
): "normal" | "low" | "critical" | "empty" {
  if (stock <= 0) return "empty";
  if (stock <= reorderPoint * 0.4) return "critical";
  if (stock <= reorderPoint) return "low";
  return "normal";
}

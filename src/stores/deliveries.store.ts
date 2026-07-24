// =============================================================================
// Deliveries Store — shipment tracking from POS checkout (localStorage demo).
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { allowMockDataSeeding } from "@/lib/mock-data-guard";
import { getSeedDeliveries } from "@/lib/mock-deliveries";
import { generateDeliveryNumber } from "@/lib/delivery-utils";
import type {
  CreateDeliveryFromCheckoutDraft,
  DeliveryRecord,
  DeliveryStatus,
  UpdateDeliveryDraft,
} from "@/types/deliveries";
import { orderRequiresPhysicalDelivery } from "@/lib/sales-transaction-utils";

const sequenceByBranchDay = new Map<string, number>();

function nextDeliverySequence(branchId: string, date: Date): number {
  const key = `${branchId}:${date.toISOString().slice(0, 10)}`;
  const next = (sequenceByBranchDay.get(key) ?? 0) + 1;
  sequenceByBranchDay.set(key, next);
  return next;
}

function qtyToDeliverForOrder(
  qty: number,
  shipQty: number | undefined,
  orderType: CreateDeliveryFromCheckoutDraft["orderFulfillmentType"],
): number {
  if (orderType === "partial_shipped") {
    return Math.max(0, shipQty ?? 0);
  }
  return qty;
}

interface DeliveriesState {
  deliveries: DeliveryRecord[];
  seedIfEmpty: () => void;
  createFromCheckout: (draft: CreateDeliveryFromCheckoutDraft, branchCode: string) => DeliveryRecord | null;
  updateDelivery: (id: string, patch: UpdateDeliveryDraft) => { ok: boolean; error?: string };
  listForTenant: (tenantId: string) => DeliveryRecord[];
}

let nextLocalId = 1;

function nextId(): string {
  nextLocalId += 1;
  return `local-del-${Date.now()}-${nextLocalId}`;
}

export const useDeliveriesStore = create<DeliveriesState>()(
  persist(
    (set, get) => ({
      deliveries: [],

      seedIfEmpty: () => {
        if (!allowMockDataSeeding()) return;
        if (get().deliveries.length > 0) return;
        set({ deliveries: getSeedDeliveries() });
      },

      createFromCheckout: (draft, branchCode) => {
        if (!orderRequiresPhysicalDelivery(draft.orderFulfillmentType)) {
          return null;
        }

        const now = new Date();
        const seq = nextDeliverySequence(draft.branchId, now);
        const deliveryNumber = generateDeliveryNumber(branchCode, now, seq);

        const sourceItems =
          draft.orderFulfillmentType === "partial_shipped"
            ? draft.items.filter((item) => (item.shipQty ?? 0) > 0)
            : draft.items;

        const items = sourceItems.map((item, idx) => {
          const qtyToDeliver = qtyToDeliverForOrder(
            item.qty,
            item.shipQty,
            draft.orderFulfillmentType,
          );
          return {
            id: `${deliveryNumber}-line-${idx}`,
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            unit: item.unit,
            qtyOrdered: item.qty,
            qtyToDeliver,
            qtyDelivered: 0,
          };
        });

        const record: DeliveryRecord = {
          id: nextId(),
          tenantId: draft.tenantId,
          branchId: draft.branchId,
          branchName: draft.branchName,
          deliveryNumber,
          salesTransactionId: draft.salesTransactionId,
          transactionNumber: draft.transactionNumber,
          orderFulfillmentType: draft.orderFulfillmentType,
          createdAt: now.toISOString(),
          customerName: draft.customerName,
          customerPhone: draft.customerPhone,
          deliveryAddress: draft.deliveryAddress,
          deliverySiteId: draft.deliverySiteId ?? null,
          deliverySiteLabel: draft.deliverySiteLabel ?? null,
          cashierId: draft.cashierId,
          cashierName: draft.cashierName,
          paymentMethod: draft.paymentMethod,
          grandTotal: draft.grandTotal,
          status: "pending",
          scheduledDate: null,
          driverName: null,
          vehiclePlate: null,
          deliveredAt: null,
          notes:
            draft.orderFulfillmentType === "partial_shipped"
              ? "Order checkout: kirim sebagian — qty dipilih di POS"
              : null,
          isOfflineSale: draft.isOfflineSale,
          items,
        };

        set((s) => ({
          deliveries: [record, ...s.deliveries],
        }));

        return record;
      },

      updateDelivery: (id, patch) => {
        const existing = get().deliveries.find((d) => d.id === id);
        if (!existing) return { ok: false, error: "Pengiriman tidak ditemukan" };

        let nextStatus: DeliveryStatus = patch.status ?? existing.status;
        let deliveredAt = patch.deliveredAt ?? existing.deliveredAt;

        if (
          patch.status === "delivered" &&
          existing.orderFulfillmentType === "partial_shipped"
        ) {
          nextStatus = "partial_delivered";
        }

        if (
          (nextStatus === "delivered" || nextStatus === "partial_delivered") &&
          !deliveredAt
        ) {
          deliveredAt = new Date().toISOString();
        }

        const items = existing.items.map((item) => {
          const linePatch = patch.items?.find((p) => p.id === item.id);
          if (!linePatch) return item;
          return {
            ...item,
            qtyDelivered: Math.min(item.qtyToDeliver, Math.max(0, linePatch.qtyDelivered)),
          };
        });

        set((s) => ({
          deliveries: s.deliveries.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: nextStatus,
                  scheduledDate:
                    patch.scheduledDate !== undefined ? patch.scheduledDate : d.scheduledDate,
                  driverName: patch.driverName !== undefined ? patch.driverName : d.driverName,
                  vehiclePlate:
                    patch.vehiclePlate !== undefined ? patch.vehiclePlate : d.vehiclePlate,
                  notes: patch.notes !== undefined ? patch.notes : d.notes,
                  deliveredAt,
                  items,
                }
              : d,
          ),
        }));

        return { ok: true };
      },

      listForTenant: (tenantId) =>
        get()
          .deliveries.filter((d) => d.tenantId === tenantId)
          .map((d) => ({
            ...d,
            deliverySiteId: d.deliverySiteId ?? null,
            deliverySiteLabel: d.deliverySiteLabel ?? null,
          }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }),
    {
      name: "ses-deliveries",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (allowMockDataSeeding()) state?.seedIfEmpty();
      },
    },
  ),
);

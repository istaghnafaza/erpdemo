// =============================================================================
// Sales Transactions Store — histori penjualan (localStorage demo).
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { allowMockDataSeeding } from "@/lib/mock-data-guard";
import { getSeedSalesTransactions } from "@/lib/mock-sales-transactions";
import type {
  RecordSaleDraft,
  SalesTransactionRecord,
  OrderFulfillmentType,
} from "@/types/sales-transactions";

export type { RecordSaleDraft, SalesTransactionItemRecord, SalesTransactionRecord, OrderFulfillmentType } from "@/types/sales-transactions";

interface SalesTransactionsState {
  transactions: SalesTransactionRecord[];
  seedIfEmpty: () => void;
  recordSale: (draft: RecordSaleDraft) => SalesTransactionRecord;
  listForTenant: (tenantId: string) => SalesTransactionRecord[];
}

let nextLocalId = 1;

function nextId(): string {
  nextLocalId += 1;
  return `local-sale-${Date.now()}-${nextLocalId}`;
}

export const useSalesTransactionsStore = create<SalesTransactionsState>()(
  persist(
    (set, get) => ({
      transactions: [],

      seedIfEmpty: () => {
        if (!allowMockDataSeeding()) return;
        if (get().transactions.length > 0) return;
        set({ transactions: getSeedSalesTransactions() });
      },

      recordSale: (draft) => {
        const record: SalesTransactionRecord = {
          id: nextId(),
          tenantId: draft.tenantId,
          branchId: draft.branchId,
          branchName: draft.branchName,
          transactionNumber: draft.transactionNumber,
          createdAt: new Date().toISOString(),
          cashierId: draft.cashierId,
          cashierName: draft.cashierName,
          customerName: draft.customerName,
          itemCount: draft.items.length,
          subtotal: draft.subtotal,
          discountAmount: draft.discountAmount,
          grandTotal: draft.grandTotal,
          paymentMethod: draft.paymentMethod,
          amountPaid: draft.amountPaid,
          changeAmount: draft.changeAmount,
          status: "completed",
          isOffline: draft.isOffline,
          orderFulfillmentType: draft.orderFulfillmentType,
          deliveryAddress: draft.deliveryAddress ?? null,
          deliverySiteId: draft.deliverySiteId ?? null,
          deliverySiteLabel: draft.deliverySiteLabel ?? null,
          items: draft.items.map((item, idx) => ({
            ...item,
            id: `${draft.transactionNumber}-line-${idx}`,
          })),
        };

        set((s) => ({
          transactions: [record, ...s.transactions],
        }));

        return record;
      },

      listForTenant: (tenantId) =>
        get()
          .transactions.filter((t) => t.tenantId === tenantId)
          .map((t) => ({
            ...t,
            orderFulfillmentType: t.orderFulfillmentType ?? "cod",
            deliveryAddress: t.deliveryAddress ?? null,
            deliverySiteId: t.deliverySiteId ?? null,
            deliverySiteLabel: t.deliverySiteLabel ?? null,
          }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }),
    {
      name: "ses-sales-transactions",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (allowMockDataSeeding()) state?.seedIfEmpty();
      },
    },
  ),
);

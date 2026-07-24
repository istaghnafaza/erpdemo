// =============================================================================
// Payables Store — mock AP + pembayaran ke supplier (Fase 12).
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { allowMockDataSeeding } from "@/lib/mock-data-guard";
import { AP_PAYMENTS, PAYABLES, type ApPaymentRecord, type Payable } from "@/lib/mock-data";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import { useFinanceStore } from "@/stores/finance.store";

export interface RecordApPaymentDraft {
  payable_id: string;
  cash_account_id: string;
  amount: number;
  user_id: string;
}

let localPaymentSeq = 100;

function nextPaymentId(): string {
  localPaymentSeq += 1;
  return `apay-mock-${String(localPaymentSeq).padStart(4, "0")}`;
}

interface PayablesState {
  mockPayables: Payable[];
  mockPayments: ApPaymentRecord[];

  recordMockPayment: (draft: RecordApPaymentDraft) => { ok: boolean; error?: string };
  resetMockPayables: () => void;
}

export const usePayablesStore = create<PayablesState>()(
  persist(
    immer((set, get) => ({
      mockPayables: [...PAYABLES],
      mockPayments: [...AP_PAYMENTS],

      recordMockPayment: (draft) => {
        if (draft.amount <= 0) return { ok: false, error: "Nominal harus lebih dari 0" };

        const payable = get().mockPayables.find((p) => p.id === draft.payable_id);
        if (!payable) return { ok: false, error: "Hutang tidak ditemukan" };

        const remaining = payable.amount - payable.paid;
        if (draft.amount > remaining) {
          return { ok: false, error: "Nominal melebihi sisa hutang" };
        }

        const account = useFinanceStore
          .getState()
          .mockCashAccounts.find(
            (a) => a.id === draft.cash_account_id && a.branch_id === payable.branchId,
          );
        if (!account) return { ok: false, error: "Akun kas/bank tidak ditemukan" };
        if (account.balance < draft.amount) {
          return { ok: false, error: `Saldo ${account.name} tidak cukup` };
        }

        const payment: ApPaymentRecord = {
          id: nextPaymentId(),
          payableId: payable.id,
          branchId: payable.branchId,
          cashAccountId: draft.cash_account_id,
          amount: draft.amount,
          paymentDate: new Date().toISOString(),
        };

        const financeResult = useFinanceStore.getState().recordMockExpense({
          tenant_id: MOCK_TENANT_ID,
          branch_id: payable.branchId,
          cash_account_id: draft.cash_account_id,
          category: "Pembelian",
          amount: draft.amount,
          description: `Bayar hutang ${payable.invoice}`,
          reference: `ap:${payment.id}`,
          user_id: draft.user_id,
        });
        if (!financeResult.ok) return financeResult;

        set((s) => {
          const target = s.mockPayables.find((p) => p.id === draft.payable_id);
          if (target) target.paid += draft.amount;
          s.mockPayments.unshift(payment);
        });

        return { ok: true };
      },

      resetMockPayables: () => {
        set({
          mockPayables: [...PAYABLES],
          mockPayments: [...AP_PAYMENTS],
        });
      },
    })),
    {
      name: "ses-payables",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mockPayables: state.mockPayables,
        mockPayments: state.mockPayments,
      }),
      onRehydrateStorage: () => (state) => {
        if (!allowMockDataSeeding() || !state) return;
        if (state.mockPayables.length === 0) {
          state.mockPayables = [...PAYABLES];
          state.mockPayments = [...AP_PAYMENTS];
        }
      },
    },
  ),
);

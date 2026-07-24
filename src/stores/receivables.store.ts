// =============================================================================
// Receivables Store — mock AR + pembayaran (Fase 12 prep).
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { allowMockDataSeeding } from "@/lib/mock-data-guard";
import { AR_PAYMENTS, RECEIVABLES, type ArPaymentRecord, type Receivable } from "@/lib/mock-data";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import { getBranchCashAccountId } from "@/lib/mock-finance";
import { useFinanceStore } from "@/stores/finance.store";

export interface RecordArPaymentDraft {
  receivable_id: string;
  cash_account_id: string;
  amount: number;
  user_id: string;
}

export interface RecordCreditSaleDraft {
  branch_id: string;
  customer_id: string;
  invoice: string;
  amount: number;
  due_days?: number;
}

let localReceivableSeq = 100;
let localPaymentSeq = 100;

function nextReceivableId(): string {
  localReceivableSeq += 1;
  return `r-mock-${String(localReceivableSeq).padStart(4, "0")}`;
}

function nextPaymentId(): string {
  localPaymentSeq += 1;
  return `ap-mock-${String(localPaymentSeq).padStart(4, "0")}`;
}

interface ReceivablesState {
  mockReceivables: Receivable[];
  mockPayments: ArPaymentRecord[];

  recordMockCreditSale: (draft: RecordCreditSaleDraft) => void;
  recordMockPayment: (draft: RecordArPaymentDraft) => { ok: boolean; error?: string };
  resetMockReceivables: () => void;
}

export const useReceivablesStore = create<ReceivablesState>()(
  persist(
    immer((set, get) => ({
      mockReceivables: [...RECEIVABLES],
      mockPayments: [...AR_PAYMENTS],

      recordMockCreditSale: (draft) => {
        if (draft.amount <= 0) return;

        const dueDays = draft.due_days ?? 30;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dueDays);

        const entry: Receivable = {
          id: nextReceivableId(),
          customerId: draft.customer_id,
          branchId: draft.branch_id,
          invoice: draft.invoice,
          amount: draft.amount,
          paid: 0,
          dueDate: dueDate.toISOString(),
          issuedDate: new Date().toISOString(),
        };

        set((s) => {
          s.mockReceivables.unshift(entry);
        });
      },

      recordMockPayment: (draft) => {
        const { receivable_id: receivableId, amount, cash_account_id, user_id } = draft;
        if (amount <= 0) return { ok: false, error: "Nominal harus lebih dari 0" };

        const receivable = get().mockReceivables.find((r) => r.id === receivableId);
        if (!receivable) return { ok: false, error: "Piutang tidak ditemukan" };

        const remaining = receivable.amount - receivable.paid;
        if (amount > remaining) {
          return { ok: false, error: "Nominal melebihi sisa tagihan" };
        }

        const cashAccountId =
          cash_account_id || getBranchCashAccountId(receivable.branchId, "kasir");
        if (!cashAccountId) {
          return { ok: false, error: "Belum ada akun kas aktif untuk cabang ini" };
        }

        const payment: ArPaymentRecord = {
          id: nextPaymentId(),
          receivableId,
          branchId: receivable.branchId,
          amount,
          paymentDate: new Date().toISOString(),
        };

        set((s) => {
          const target = s.mockReceivables.find((r) => r.id === receivableId);
          if (target) target.paid += amount;
          s.mockPayments.unshift(payment);
        });

        useFinanceStore.getState().recordMockIncome({
          tenant_id: MOCK_TENANT_ID,
          branch_id: receivable.branchId,
          cash_account_id: cashAccountId,
          category: "Penagihan Piutang",
          amount,
          description: `Pelunasan piutang ${receivable.invoice}`,
          reference: `ar:${payment.id}`,
          user_id: user_id,
        });

        return { ok: true };
      },

      resetMockReceivables: () => {
        set({
          mockReceivables: [...RECEIVABLES],
          mockPayments: [...AR_PAYMENTS],
        });
      },
    })),
    {
      name: "ses-receivables",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mockReceivables: state.mockReceivables,
        mockPayments: state.mockPayments,
      }),
      onRehydrateStorage: () => (state) => {
        if (!allowMockDataSeeding() || !state) return;
        if (state.mockReceivables.length === 0) {
          state.mockReceivables = [...RECEIVABLES];
          state.mockPayments = [...AR_PAYMENTS];
        }
      },
    },
  ),
);

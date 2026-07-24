// =============================================================================
// Finance Store — mock cash accounts & transactions (Fase 11).
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { allowMockDataSeeding } from "@/lib/mock-data-guard";
import {
  getSeedMockCashAccounts,
  getSeedMockCashTransactions,
  getNextMockCashTxId,
  clearBranchFinanceData,
  ensureMockCashAccounts,
  resolveCashAccountForPayment,
  getBranchCashAccountId,
  EMPTY_FINANCE_BRANCH_IDS,
  type MockCashTxWithAccount,
} from "@/lib/mock-finance";
import type { SalesTransactionRecord } from "@/types/sales-transactions";
import type { CashAccount } from "@/types/database";
import type { ApPaymentRecord, ArPaymentRecord, Payable, Receivable } from "@/lib/mock-data";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";

export interface RecordExpenseDraft {
  tenant_id: string;
  branch_id: string;
  cash_account_id: string;
  category: string;
  amount: number;
  description: string | null;
  reference: string | null;
  user_id: string;
}

export interface RecordIncomeDraft {
  tenant_id: string;
  branch_id: string;
  cash_account_id: string;
  category: string;
  amount: number;
  description: string | null;
  reference: string | null;
  user_id: string;
}

export interface RecordSaleCogsDraft {
  tenant_id: string;
  branch_id: string;
  amount: number;
  description: string | null;
  reference: string | null;
  user_id: string;
}

interface FinanceState {
  mockCashAccounts: CashAccount[];
  mockCashTransactions: MockCashTxWithAccount[];

  recordMockExpense: (draft: RecordExpenseDraft) => { ok: boolean; error?: string };
  recordMockIncome: (draft: RecordIncomeDraft) => { ok: boolean; error?: string };
  recordMockSaleCogs: (draft: RecordSaleCogsDraft) => { ok: boolean; error?: string };
  resetMockFinance: () => void;
  clearMockFinanceForBranches: (branchIds: string[]) => void;
  /** Pastikan akun cabang ada + sinkron penjualan POS yang belum masuk buku kas. */
  initializeMockFinance: (sales?: SalesTransactionRecord[]) => void;
  /** Backfill pembayaran piutang/hutang historis yang belum tercatat di buku kas. */
  syncHistoricalArApPayments: (params: {
    receivables: Receivable[];
    arPayments: ArPaymentRecord[];
    payables: Payable[];
    apPayments: ApPaymentRecord[];
  }) => void;
}

function buildInitialFinanceState(): Pick<FinanceState, "mockCashAccounts" | "mockCashTransactions"> {
  const accounts = getSeedMockCashAccounts();
  const cleared = clearBranchFinanceData(
    accounts,
    getSeedMockCashTransactions(accounts),
    Array.from(EMPTY_FINANCE_BRANCH_IDS),
  );
  return {
    mockCashAccounts: cleared.accounts,
    mockCashTransactions: cleared.transactions,
  };
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    immer((set, get) => ({
      ...buildInitialFinanceState(),

      recordMockExpense: (draft) => {
        if (draft.amount <= 0) return { ok: false, error: "Nominal harus lebih dari 0" };

        const account = get().mockCashAccounts.find(
          (a) => a.id === draft.cash_account_id && a.branch_id === draft.branch_id,
        );
        if (!account) return { ok: false, error: "Akun kas/bank tidak ditemukan" };
        if (account.balance < draft.amount) {
          return { ok: false, error: `Saldo ${account.name} tidak cukup` };
        }

        const tx: MockCashTxWithAccount = {
          id: getNextMockCashTxId(),
          tenant_id: draft.tenant_id,
          branch_id: draft.branch_id,
          cash_account_id: draft.cash_account_id,
          type: "expense",
          category: draft.category,
          amount: draft.amount,
          reference: draft.reference,
          description: draft.description,
          user_id: draft.user_id,
          created_at: new Date().toISOString(),
          account: { name: account.name, type: account.type },
        };

        set((s) => {
          const acc = s.mockCashAccounts.find(
            (a) => a.id === draft.cash_account_id && a.branch_id === draft.branch_id,
          );
          if (acc) acc.balance -= draft.amount;
          s.mockCashTransactions.unshift(tx);
        });

        return { ok: true };
      },

      recordMockIncome: (draft) => {
        if (draft.amount <= 0) return { ok: false, error: "Nominal harus lebih dari 0" };

        const account = get().mockCashAccounts.find(
          (a) => a.id === draft.cash_account_id && a.branch_id === draft.branch_id,
        );
        if (!account) return { ok: false, error: "Akun kas/bank tidak ditemukan" };

        const tx: MockCashTxWithAccount = {
          id: getNextMockCashTxId(),
          tenant_id: draft.tenant_id,
          branch_id: draft.branch_id,
          cash_account_id: draft.cash_account_id,
          type: "income",
          category: draft.category,
          amount: draft.amount,
          reference: draft.reference,
          description: draft.description,
          user_id: draft.user_id,
          created_at: new Date().toISOString(),
          account: { name: account.name, type: account.type },
        };

        set((s) => {
          const acc = s.mockCashAccounts.find(
            (a) => a.id === draft.cash_account_id && a.branch_id === draft.branch_id,
          );
          if (acc) acc.balance += draft.amount;
          s.mockCashTransactions.unshift(tx);
        });

        return { ok: true };
      },

      /** HPP penjualan POS — mempengaruhi P&L, tidak mengurangi saldo kas. */
      recordMockSaleCogs: (draft) => {
        if (draft.amount <= 0) return { ok: true };

        const tx: MockCashTxWithAccount = {
          id: getNextMockCashTxId(),
          tenant_id: draft.tenant_id,
          branch_id: draft.branch_id,
          cash_account_id: draft.branch_id,
          type: "expense",
          category: "HPP",
          amount: draft.amount,
          reference: draft.reference,
          description: draft.description,
          user_id: draft.user_id,
          created_at: new Date().toISOString(),
        };

        set((s) => {
          s.mockCashTransactions.unshift(tx);
        });

        return { ok: true };
      },

      resetMockFinance: () => {
        set(buildInitialFinanceState());
      },

      clearMockFinanceForBranches: (branchIds) => {
        set((s) => {
          const cleared = clearBranchFinanceData(
            s.mockCashAccounts,
            s.mockCashTransactions,
            branchIds,
          );
          s.mockCashAccounts = cleared.accounts;
          s.mockCashTransactions = cleared.transactions;
        });
      },

      initializeMockFinance: (sales = []) => {
        const extraBranchIds = [...new Set(sales.map((s) => s.branchId))];
        const incomeRefs = new Set(
          get()
            .mockCashTransactions.filter((t) => t.reference)
            .map((t) => t.reference as string),
        );

        set((s) => {
          s.mockCashAccounts = ensureMockCashAccounts(s.mockCashAccounts, extraBranchIds);
        });

        for (const sale of sales) {
          if (sale.status !== "completed") continue;
          if (incomeRefs.has(sale.transactionNumber)) continue;

          if (sale.paymentMethod === "credit") {
            if (sale.amountPaid <= 0) continue;
            const accountId = resolveCashAccountForPayment("cash", sale.branchId);
            if (!accountId) continue;
            const result = get().recordMockIncome({
              tenant_id: sale.tenantId,
              branch_id: sale.branchId,
              cash_account_id: accountId,
              category: "Penjualan",
              amount: sale.amountPaid,
              description: `DP penjualan kredit ${sale.transactionNumber}`,
              reference: sale.transactionNumber,
              user_id: sale.cashierId,
            });
            if (result.ok) incomeRefs.add(sale.transactionNumber);
            continue;
          }

          const accountId = resolveCashAccountForPayment(sale.paymentMethod, sale.branchId);
          if (!accountId) continue;

          const result = get().recordMockIncome({
            tenant_id: sale.tenantId,
            branch_id: sale.branchId,
            cash_account_id: accountId,
            category: "Penjualan",
            amount: sale.grandTotal,
            description: sale.customerName
              ? `Penjualan ke ${sale.customerName}`
              : "Penjualan tunai POS",
            reference: sale.transactionNumber,
            user_id: sale.cashierId,
          });
          if (result.ok) incomeRefs.add(sale.transactionNumber);
        }
      },

      syncHistoricalArApPayments: ({ receivables, arPayments, payables, apPayments }) => {
        const syncedRefs = new Set(
          get()
            .mockCashTransactions.filter((t) => t.reference)
            .map((t) => t.reference as string),
        );

        for (const payment of arPayments) {
          const ref = `ar:${payment.id}`;
          if (syncedRefs.has(ref)) continue;

          const receivable = receivables.find((r) => r.id === payment.receivableId);
          if (!receivable) continue;

          const accountId = getBranchCashAccountId(receivable.branchId, "kasir");
          const account = get().mockCashAccounts.find(
            (a) => a.id === accountId && a.branch_id === receivable.branchId,
          );
          if (!account) continue;

          const tx: MockCashTxWithAccount = {
            id: getNextMockCashTxId(),
            tenant_id: MOCK_TENANT_ID,
            branch_id: receivable.branchId,
            cash_account_id: accountId,
            type: "income",
            category: "Penagihan Piutang",
            amount: payment.amount,
            reference: ref,
            description: `Pelunasan piutang ${receivable.invoice}`,
            user_id: "33331111-0000-0000-0000-000000000001",
            created_at: payment.paymentDate,
            account: { name: account.name, type: account.type },
          };

          set((s) => {
            const acc = s.mockCashAccounts.find(
              (a) => a.id === accountId && a.branch_id === receivable.branchId,
            );
            if (acc) acc.balance += payment.amount;
            s.mockCashTransactions.unshift(tx);
          });
          syncedRefs.add(ref);
        }

        for (const payment of apPayments) {
          const ref = `ap:${payment.id}`;
          if (syncedRefs.has(ref)) continue;

          const payable = payables.find((p) => p.id === payment.payableId);
          if (!payable) continue;

          const accountId =
            payment.cashAccountId || getBranchCashAccountId(payable.branchId, "bca");
          const account = get().mockCashAccounts.find(
            (a) => a.id === accountId && a.branch_id === payable.branchId,
          );
          if (!account) continue;

          const tx: MockCashTxWithAccount = {
            id: getNextMockCashTxId(),
            tenant_id: MOCK_TENANT_ID,
            branch_id: payable.branchId,
            cash_account_id: accountId,
            type: "expense",
            category: "Pembelian",
            amount: payment.amount,
            reference: ref,
            description: `Bayar hutang ${payable.invoice}`,
            user_id: "33331111-0000-0000-0000-000000000001",
            created_at: payment.paymentDate,
            account: { name: account.name, type: account.type },
          };

          set((s) => {
            const acc = s.mockCashAccounts.find(
              (a) => a.id === accountId && a.branch_id === payable.branchId,
            );
            if (acc) acc.balance -= payment.amount;
            s.mockCashTransactions.unshift(tx);
          });
          syncedRefs.add(ref);
        }
      },
    })),
    {
      name: "ses-finance",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mockCashAccounts: state.mockCashAccounts,
        mockCashTransactions: state.mockCashTransactions,
      }),
      onRehydrateStorage: () => (state) => {
        if (!allowMockDataSeeding() || !state) return;
        const initial = buildInitialFinanceState();
        state.mockCashAccounts = ensureMockCashAccounts(
          state.mockCashAccounts.length > 0
            ? state.mockCashAccounts
            : initial.mockCashAccounts,
        );
        if (state.mockCashTransactions.length === 0) {
          state.mockCashTransactions = initial.mockCashTransactions;
        }
      },
    },
  ),
);

// =============================================================================
// Mock Finance — cash accounts & transactions for demo sessions.
// =============================================================================

import { CASH_ACCOUNTS, CASH_BOOK } from "@/lib/mock-data";
import {
  MOCK_BRANCH_BEKASI,
  MOCK_BRANCH_IDS,
  MOCK_BRANCH_KEBONJERUK,
  MOCK_BRANCH_SUDIRMAN,
  MOCK_TENANT_ID,
} from "@/lib/mock-ids";
import type { CashAccount, CashTransaction, DbCashTxType } from "@/types/database";

const MOCK_USER_OWNER = "33331111-0000-0000-0000-000000000001";

const BRANCH_ACCOUNT_PREFIX: Record<string, string> = {
  [MOCK_BRANCH_SUDIRMAN]: "cc111111",
  [MOCK_BRANCH_KEBONJERUK]: "cc211111",
  [MOCK_BRANCH_BEKASI]: "cc311111",
};

function branchAccountPrefix(branchId: string): string {
  return BRANCH_ACCOUNT_PREFIX[branchId] ?? `cc${branchId.replace(/-/g, "").slice(-6)}`;
}

const ACCOUNT_SLOTS = {
  kasir: 1,
  brankas: 2,
  bca: 3,
  mandiri: 4,
} as const;

export type BranchCashAccountRole = keyof typeof ACCOUNT_SLOTS;

export function getBranchCashAccountId(
  branchId: string,
  role: BranchCashAccountRole,
): string {
  const prefix = branchAccountPrefix(branchId);
  return `${prefix}-0000-0000-0000-${String(ACCOUNT_SLOTS[role]).padStart(12, "0")}`;
}

/** Backward-compatible Sudirman defaults */
export const MOCK_CASH_ACCOUNT_KASIR = getBranchCashAccountId(
  MOCK_BRANCH_SUDIRMAN,
  "kasir",
);
export const MOCK_CASH_ACCOUNT_BRANKAS = getBranchCashAccountId(
  MOCK_BRANCH_SUDIRMAN,
  "brankas",
);
export const MOCK_CASH_ACCOUNT_BCA = getBranchCashAccountId(MOCK_BRANCH_SUDIRMAN, "bca");
export const MOCK_CASH_ACCOUNT_MANDIRI = getBranchCashAccountId(
  MOCK_BRANCH_SUDIRMAN,
  "mandiri",
);

export const EXPENSE_CATEGORIES = [
  "Operasional",
  "Utilitas",
  "Pembelian",
  "Gaji",
  "Transport",
  "Lainnya",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Tentukan akun kas/bank untuk metode bayar POS. Kredit = null (masuk piutang). */
export function resolveCashAccountForPayment(
  method: string,
  branchId: string,
): string | null {
  if (method === "credit") return null;
  if (method === "cash") return getBranchCashAccountId(branchId, "kasir");
  return getBranchCashAccountId(branchId, "bca");
}

export interface MockCashTxWithAccount extends CashTransaction {
  account?: { name: string; type: CashAccount["type"] };
}

let localTxSeq = 100;

export function getNextMockCashTxId(): string {
  localTxSeq += 1;
  return `cc121111-0000-0000-0000-${String(Date.now()).slice(-8)}${String(localTxSeq).padStart(4, "0")}`;
}

function mapLegacyCategoryToType(category: string, amount: number): DbCashTxType {
  if (category === "Setoran") return "transfer";
  return amount >= 0 ? "income" : "expense";
}

const SEED_ACCOUNT_ROLES: Array<{ legacyId: string; role: BranchCashAccountRole }> = [
  { legacyId: "k1", role: "kasir" },
  { legacyId: "k2", role: "brankas" },
  { legacyId: "b1", role: "bca" },
  { legacyId: "b2", role: "mandiri" },
];

/** Cabang yang dimulai kosong (saldo 0, tanpa riwayat seed). */
export const EMPTY_FINANCE_BRANCH_IDS = new Set([
  MOCK_BRANCH_SUDIRMAN,
  MOCK_BRANCH_BEKASI,
]);

/** Cabang yang memakai saldo & buku kas seed demo. */
export const SEED_FINANCE_BRANCH_ID = MOCK_BRANCH_KEBONJERUK;

export function getSeedMockCashAccounts(): CashAccount[] {
  const accounts: CashAccount[] = [];

  for (const branchId of MOCK_BRANCH_IDS) {
    for (const { legacyId, role } of SEED_ACCOUNT_ROLES) {
      const template = CASH_ACCOUNTS.find((a) => a.id === legacyId);
      if (!template) continue;

      accounts.push({
        id: getBranchCashAccountId(branchId, role),
        tenant_id: MOCK_TENANT_ID,
        branch_id: branchId,
        name: template.name,
        type: template.type,
        account_number:
          template.type === "bank" ? template.name.split(" - ")[1] ?? null : null,
        balance: EMPTY_FINANCE_BRANCH_IDS.has(branchId) ? 0 : template.balance,
        is_active: true,
      });
    }
  }

  return accounts;
}

/** Pastikan setiap cabang punya 4 akun kas/bank — merge dengan saldo persist. */
export function ensureMockCashAccounts(
  existing: CashAccount[],
  extraBranchIds: string[] = [],
): CashAccount[] {
  const branchIds = new Set<string>([...MOCK_BRANCH_IDS, ...extraBranchIds]);
  const byId = new Map(
    existing.map((a) => [a.id, { ...a, is_active: a.is_active ?? true }]),
  );

  for (const branchId of branchIds) {
    for (const { legacyId, role } of SEED_ACCOUNT_ROLES) {
      const template = CASH_ACCOUNTS.find((a) => a.id === legacyId);
      if (!template) continue;

      const id = getBranchCashAccountId(branchId, role);
      const persisted = byId.get(id);
      const seedBalance = EMPTY_FINANCE_BRANCH_IDS.has(branchId) ? 0 : template.balance;

      byId.set(id, {
        id,
        tenant_id: MOCK_TENANT_ID,
        branch_id: branchId,
        name: template.name,
        type: template.type,
        account_number:
          template.type === "bank" ? template.name.split(" - ")[1] ?? null : null,
        balance: persisted?.balance ?? seedBalance,
        is_active: persisted?.is_active ?? true,
      });
    }
  }

  return Array.from(byId.values());
}

export function getSeedMockCashTransactions(
  accounts: CashAccount[],
): MockCashTxWithAccount[] {
  const seedAccounts = accounts.filter((a) => a.branch_id === SEED_FINANCE_BRANCH_ID);
  const accountByName = new Map(seedAccounts.map((a) => [a.name, a]));

  return CASH_BOOK.map((entry, idx) => {
    const account = accountByName.get(entry.account);
    const type = mapLegacyCategoryToType(entry.category, entry.amount);
    const amount = Math.abs(entry.amount);
    const createdAt = new Date(entry.date);
    createdAt.setHours(10 + (idx % 8), (idx * 7) % 60, 0, 0);

    return {
      id: `cc121111-0000-0000-0000-${String(idx + 1).padStart(12, "0")}`,
      tenant_id: MOCK_TENANT_ID,
      branch_id: SEED_FINANCE_BRANCH_ID,
      cash_account_id:
        account?.id ?? getBranchCashAccountId(SEED_FINANCE_BRANCH_ID, "bca"),
      type,
      category: entry.category,
      amount,
      reference: null,
      description: entry.description,
      user_id: MOCK_USER_OWNER,
      created_at: createdAt.toISOString(),
      account: account
        ? { name: account.name, type: account.type }
        : { name: entry.account, type: "bank" },
    };
  });
}

/** Hapus semua transaksi & nolkan saldo akun untuk cabang tertentu. */
export function clearBranchFinanceData(
  accounts: CashAccount[],
  transactions: MockCashTxWithAccount[],
  branchIds: string[],
): { accounts: CashAccount[]; transactions: MockCashTxWithAccount[] } {
  const targets = new Set(branchIds);
  return {
    accounts: accounts.map((a) =>
      targets.has(a.branch_id) ? { ...a, balance: 0 } : a,
    ),
    transactions: transactions.filter((t) => !targets.has(t.branch_id)),
  };
}

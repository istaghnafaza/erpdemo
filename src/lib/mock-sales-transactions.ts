// =============================================================================
// Seed histori penjualan demo — konsisten dengan mock-data & cabang seed.
// =============================================================================

import { RECENT_TRANSACTIONS } from "@/lib/mock-data";
import {
  MOCK_BRANCH_BEKASI,
  MOCK_BRANCH_KEBONJERUK,
  MOCK_BRANCH_SUDIRMAN,
  MOCK_TENANT_ID,
} from "@/lib/mock-ids";
import { paymentMethodFromLegacy } from "@/lib/sales-transaction-utils";
import { SEED_TENANT_USERS } from "@/lib/mock-users";
import type { PaymentMethod } from "@/types/app";
import type { SalesTransactionRecord } from "@/types/sales-transactions";
import type { OrderFulfillmentType } from "@/types/sales-transactions";

const BRANCH_NAMES: Record<string, string> = {
  [MOCK_BRANCH_SUDIRMAN]: "Cabang Sudirman",
  [MOCK_BRANCH_KEBONJERUK]: "Cabang Kebon Jeruk",
  [MOCK_BRANCH_BEKASI]: "Cabang Bekasi",
};

const BRANCH_CODES: Record<string, string> = {
  [MOCK_BRANCH_SUDIRMAN]: "SDR",
  [MOCK_BRANCH_KEBONJERUK]: "KBJ",
  [MOCK_BRANCH_BEKASI]: "BKS",
};

const BRANCH_ROTATION = [MOCK_BRANCH_SUDIRMAN, MOCK_BRANCH_KEBONJERUK, MOCK_BRANCH_BEKASI];

function findCashier(name: string) {
  return SEED_TENANT_USERS.find((u) => u.name === name) ?? SEED_TENANT_USERS[3];
}

function makeItems(count: number, total: number) {
  const unit = Math.max(1, Math.floor(total / Math.max(count, 1)));
  return Array.from({ length: Math.max(1, count) }, (_, i) => ({
    id: `seed-item-${i}`,
    productId: `44441111-0000-0000-0000-00000000000${(i % 9) + 1}`,
    productName: i === 0 ? "Semen Portland 50kg" : `Produk demo ${i + 1}`,
    sku: `BRG-00${(i % 9) + 1}`,
    unit: "pcs",
    qty: 1,
    purchasePrice: Math.round(unit * 0.7),
    sellingPrice: unit,
    discount: 0,
    subtotal: unit,
  }));
}

function toRecord(
  input: {
    id: string;
    invoice: string;
    date: string;
    branchId: string;
    cashierName: string;
    customer?: string;
    items: number;
    total: number;
    method: PaymentMethod;
    status: "completed" | "voided";
    isOffline?: boolean;
    orderFulfillmentType?: OrderFulfillmentType;
  },
): SalesTransactionRecord {
  const cashier = findCashier(input.cashierName);
  const subtotal = Math.round(input.total * 1.02);
  const discountAmount = Math.max(0, subtotal - input.total);

  return {
    id: input.id,
    tenantId: MOCK_TENANT_ID,
    branchId: input.branchId,
    branchName: BRANCH_NAMES[input.branchId] ?? "Cabang",
    transactionNumber: input.invoice,
    createdAt: input.date,
    cashierId: cashier.id,
    cashierName: cashier.name,
    customerName: input.customer ?? null,
    itemCount: input.items,
    subtotal,
    discountAmount,
    grandTotal: input.total,
    paymentMethod: input.method,
    amountPaid: input.method === "credit" ? 0 : input.total,
    changeAmount: 0,
    status: input.status,
    isOffline: input.isOffline ?? false,
    orderFulfillmentType: input.orderFulfillmentType ?? "cod",
    items: makeItems(input.items, input.total),
  };
}

export function getSeedSalesTransactions(): SalesTransactionRecord[] {
  const fromRecent = RECENT_TRANSACTIONS.map((t, idx) =>
    toRecord({
      id: t.id,
      invoice: t.invoice,
      date: t.date,
      branchId: BRANCH_ROTATION[idx % BRANCH_ROTATION.length],
      cashierName: t.cashier,
      customer: t.customer,
      items: t.items,
      total: t.total,
      method: paymentMethodFromLegacy(t.method),
      status: t.status === "void" ? "voided" : "completed",
      orderFulfillmentType:
        t.method === "Piutang" ? "shipped" : t.method === "Transfer" ? "partial_shipped" : "cod",
    }),
  );

  const extra: SalesTransactionRecord[] = [];
  const today = new Date();
  const cashiers = ["Andi Pratama", "Siti Rahma", "Rudi Hermawan"];
  const orderTypes: OrderFulfillmentType[] = ["cod", "shipped", "partial_shipped"];
  const methods: PaymentMethod[] = ["cash", "transfer", "qris_edc", "credit", "card"];
  const customers = [null, "PT Abadi Jaya Konstruksi", "Toko Pak Budi", "CV Maju Bersama"];

  for (let day = 2; day <= 28; day++) {
    const perDay = day % 7 === 0 || day % 7 === 6 ? 3 : 2;
    for (let n = 0; n < perDay; n++) {
      const d = new Date(today);
      d.setDate(d.getDate() - day);
      d.setHours(9 + n * 3, 15 + n * 7, 0, 0);

      const branchId = BRANCH_ROTATION[(day + n) % BRANCH_ROTATION.length];
      const branchCode = BRANCH_CODES[branchId];
      const seq = 1000 - day * 10 - n;
      const total = 180_000 + ((day * 17 + n * 53_000) % 4_500_000);
      const cashierName = cashiers[(day + n) % cashiers.length];

      extra.push(
        toRecord({
          id: `seed-hist-${day}-${n}`,
          invoice: `TRX-${branchCode}-2026${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(seq).padStart(4, "0")}`,
          date: d.toISOString(),
          branchId,
          cashierName,
          customer: customers[(day + n) % customers.length] ?? undefined,
          items: 1 + ((day + n) % 6),
          total,
          method: methods[(day + n) % methods.length],
          status: day === 14 && n === 1 ? "voided" : "completed",
          isOffline: day === 5 && n === 0,
          orderFulfillmentType: orderTypes[(day + n) % orderTypes.length],
        }),
      );
    }
  }

  return [...fromRecent, ...extra].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

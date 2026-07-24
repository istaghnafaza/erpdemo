// Centralized mock data for SES demo — all modules pull from here so numbers stay consistent.

export type Role = "owner" | "manager" | "kasir";

export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: Role;
  avatar: string;
}

export const USERS: User[] = [
  { id: "u1", name: "Budi Santoso", username: "budi", password: "owner", role: "owner", avatar: "BS" },
  { id: "u2", name: "Siti Rahma", username: "siti", password: "manager", role: "manager", avatar: "SR" },
  { id: "u3", name: "Andi Pratama", username: "andi", password: "kasir", role: "kasir", avatar: "AP" },
];

export const STORE = {
  name: "Toko Bangunan Simetri",
  branch: "Cabang Sudirman, Jakarta",
  address: "Jl. Jend. Sudirman No. 42, Jakarta Pusat",
  phone: "(021) 555-1234",
};

export type StockStatus = "normal" | "low" | "critical";

export interface Product {
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  location: string;
}

export const PRODUCTS: Product[] = [
  { sku: "BRG-001", name: "Semen Portland 50kg", category: "Semen & Beton", unit: "sak", costPrice: 57000, sellPrice: 65000, stock: 80, minStock: 20, location: "A-01" },
  { sku: "BRG-002", name: "Bata Merah", category: "Bata & Blok", unit: "pcs", costPrice: 800, sellPrice: 1100, stock: 1200, minStock: 500, location: "B-03" },
  { sku: "BRG-003", name: "Cat Tembok Putih 5kg", category: "Cat & Finishing", unit: "kaleng", costPrice: 38000, sellPrice: 45000, stock: 3, minStock: 10, location: "C-02" },
  { sku: "BRG-004", name: 'Pipa PVC 3/4"', category: "Pipa & Sanitasi", unit: "btg", costPrice: 18000, sellPrice: 22000, stock: 8, minStock: 15, location: "D-04" },
  { sku: "BRG-005", name: "Keramik 40x40 Putih", category: "Keramik & Lantai", unit: "dus", costPrice: 65000, sellPrice: 78000, stock: 30, minStock: 10, location: "E-01" },
  { sku: "BRG-006", name: "Bata Ringan 7.5cm", category: "Bata & Blok", unit: "kubik", costPrice: 65000, sellPrice: 85000, stock: 5, minStock: 8, location: "B-05" },
  { sku: "BRG-007", name: "Besi Hollow 4x4", category: "Besi & Logam", unit: "btg", costPrice: 85000, sellPrice: 105000, stock: 25, minStock: 10, location: "F-02" },
  { sku: "BRG-008", name: "Cat Besi Hitam 1kg", category: "Cat & Finishing", unit: "kaleng", costPrice: 28000, sellPrice: 35000, stock: 12, minStock: 6, location: "C-03" },
  { sku: "BRG-009", name: "Triplek 9mm", category: "Kayu & Triplek", unit: "lbr", costPrice: 95000, sellPrice: 120000, stock: 40, minStock: 15, location: "G-01" },
  { sku: "BRG-010", name: "Genteng Beton", category: "Atap & Rangka", unit: "pcs", costPrice: 3500, sellPrice: 5000, stock: 200, minStock: 100, location: "H-02" },
  { sku: "BRG-011", name: "Kawat Beton 1kg", category: "Besi & Logam", unit: "kg", costPrice: 18000, sellPrice: 23000, stock: 2, minStock: 8, location: "F-04" },
  { sku: "BRG-012", name: 'Paku Beton 3"', category: "Besi & Logam", unit: "kg", costPrice: 12000, sellPrice: 16000, stock: 30, minStock: 10, location: "F-05" },
  { sku: "BRG-013", name: "Pasir Cor 1m³", category: "Semen & Beton", unit: "m³", costPrice: 280000, sellPrice: 340000, stock: 18, minStock: 5, location: "A-04" },
  { sku: "BRG-014", name: "Kran Air Stainless", category: "Pipa & Sanitasi", unit: "pcs", costPrice: 45000, sellPrice: 65000, stock: 22, minStock: 8, location: "D-06" },
  { sku: "BRG-015", name: "Lem Kayu 250gr", category: "Cat & Finishing", unit: "btl", costPrice: 14000, sellPrice: 19000, stock: 35, minStock: 10, location: "C-05" },
  { sku: "BRG-016", name: "Kabel NYM 2x1.5", category: "Listrik", unit: "rol", costPrice: 320000, sellPrice: 395000, stock: 9, minStock: 4, location: "I-01" },
];

export function stockStatus(p: Product): StockStatus {
  if (p.stock <= p.minStock * 0.4) return "critical";
  if (p.stock <= p.minStock) return "low";
  return "normal";
}

export const CATEGORIES = Array.from(new Set(PRODUCTS.map((p) => p.category)));

export interface Customer {
  id: string;
  name: string;
  type: "perusahaan" | "perorangan";
  phone: string;
}

export const CUSTOMERS: Customer[] = [
  { id: "c1", name: "PT Abadi Jaya Konstruksi", type: "perusahaan", phone: "0812-1111-2222" },
  { id: "c2", name: "Toko Pak Budi", type: "perorangan", phone: "0813-3333-4444" },
  { id: "c3", name: "CV Maju Bersama", type: "perusahaan", phone: "0815-5555-6666" },
  { id: "c4", name: "Bapak Hendra (Renovasi Rumah)", type: "perorangan", phone: "0817-7777-8888" },
  { id: "c5", name: "PT Sentosa Properti", type: "perusahaan", phone: "0819-9999-0000" },
];

export interface Receivable {
  id: string;
  customerId: string;
  branchId: string;
  invoice: string;
  amount: number;
  paid: number;
  dueDate: string; // ISO
  issuedDate: string;
}

export interface ArPaymentRecord {
  id: string;
  receivableId: string;
  branchId: string;
  amount: number;
  paymentDate: string;
}

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const daysAhead = (n: number) => daysAgo(-n);

export const RECEIVABLES: Receivable[] = [
  { id: "r1", customerId: "c1", branchId: "22221111-0000-0000-0000-000000000001", invoice: "INV-2026-0421", amount: 12000000, paid: 0, dueDate: daysAgo(5), issuedDate: daysAgo(35) },
  { id: "r2", customerId: "c2", branchId: "22221111-0000-0000-0000-000000000001", invoice: "INV-2026-0436", amount: 5500000, paid: 2000000, dueDate: daysAhead(3), issuedDate: daysAgo(27) },
  { id: "r3", customerId: "c3", branchId: "22221111-0000-0000-0000-000000000002", invoice: "INV-2026-0442", amount: 8000000, paid: 0, dueDate: daysAhead(12), issuedDate: daysAgo(18) },
  { id: "r4", customerId: "c5", branchId: "22221111-0000-0000-0000-000000000001", invoice: "INV-2026-0451", amount: 24500000, paid: 10000000, dueDate: daysAhead(8), issuedDate: daysAgo(22) },
  { id: "r5", customerId: "c4", branchId: "22221111-0000-0000-0000-000000000002", invoice: "INV-2026-0463", amount: 3400000, paid: 0, dueDate: daysAgo(2), issuedDate: daysAgo(32) },
  { id: "r6", customerId: "c1", branchId: "22221111-0000-0000-0000-000000000003", invoice: "INV-2026-0478", amount: 18000000, paid: 0, dueDate: daysAhead(20), issuedDate: daysAgo(10) },
  { id: "r7", customerId: "c3", branchId: "22221111-0000-0000-0000-000000000003", invoice: "INV-2026-0481", amount: 16000000, paid: 0, dueDate: daysAhead(15), issuedDate: daysAgo(15) },
];

/** Pembayaran piutang — untuk hitung penagihan bulan berjalan. */
export const AR_PAYMENTS: ArPaymentRecord[] = [
  { id: "ap1", receivableId: "r4", branchId: "22221111-0000-0000-0000-000000000001", amount: 10_000_000, paymentDate: daysAgo(3) },
  { id: "ap2", receivableId: "r2", branchId: "22221111-0000-0000-0000-000000000001", amount: 2_000_000, paymentDate: daysAgo(1) },
];

export interface Supplier {
  id: string;
  name: string;
  phone: string;
}

export const SUPPLIERS: Supplier[] = [
  { id: "s1", name: "PT Indocement Distribusi", phone: "021-555-1010" },
  { id: "s2", name: "UD Bata Sejahtera", phone: "021-555-2020" },
  { id: "s3", name: "PT Avia Avian (Cat)", phone: "021-555-3030" },
  { id: "s4", name: "PT Krakatau Steel", phone: "021-555-4040" },
];

export interface Payable {
  id: string;
  supplierId: string;
  branchId: string;
  invoice: string;
  amount: number;
  paid: number;
  dueDate: string;
  issuedDate: string;
}

export interface ApPaymentRecord {
  id: string;
  payableId: string;
  branchId: string;
  cashAccountId: string;
  amount: number;
  paymentDate: string;
}

export const PAYABLES: Payable[] = [
  { id: "p1", supplierId: "s1", branchId: "22221111-0000-0000-0000-000000000001", invoice: "PO-2026-0112", amount: 14500000, paid: 0, dueDate: daysAhead(5), issuedDate: daysAgo(25) },
  { id: "p2", supplierId: "s3", branchId: "22221111-0000-0000-0000-000000000002", invoice: "PO-2026-0118", amount: 6800000, paid: 0, dueDate: daysAhead(12), issuedDate: daysAgo(18) },
  { id: "p3", supplierId: "s4", branchId: "22221111-0000-0000-0000-000000000003", invoice: "PO-2026-0124", amount: 9200000, paid: 4000000, dueDate: daysAhead(2), issuedDate: daysAgo(28) },
  { id: "p4", supplierId: "s2", branchId: "22221111-0000-0000-0000-000000000001", invoice: "PO-2026-0131", amount: 3000000, paid: 0, dueDate: daysAgo(3), issuedDate: daysAgo(33) },
];

export const AP_PAYMENTS: ApPaymentRecord[] = [
  {
    id: "apay1",
    payableId: "p3",
    branchId: "22221111-0000-0000-0000-000000000003",
    cashAccountId: "cc311111-0000-0000-0000-000000000003",
    amount: 4_000_000,
    paymentDate: daysAgo(5),
  },
];

// Daily sales history for last 30 days — varies for nice chart
export const SALES_HISTORY = (() => {
  const out: { date: string; total: number; transactions: number }[] = [];
  const base = 4_200_000;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const weekendBoost = dow === 0 ? 0.6 : dow === 6 ? 1.35 : 1;
    const wave = Math.sin(i / 3.5) * 0.25;
    const noise = (Math.sin(i * 7.3) + Math.cos(i * 3.1)) * 0.18;
    const total = Math.round(base * weekendBoost * (1 + wave + noise));
    const transactions = Math.round(18 * weekendBoost * (1 + wave * 0.4));
    out.push({ date: d.toISOString(), total, transactions });
  }
  return out;
})();

export const TOP_PRODUCTS = [
  { sku: "BRG-001", name: "Semen Portland 50kg", qty: 412, revenue: 26_780_000 },
  { sku: "BRG-002", name: "Bata Merah", qty: 8_500, revenue: 9_350_000 },
  { sku: "BRG-005", name: "Keramik 40x40 Putih", qty: 184, revenue: 14_352_000 },
  { sku: "BRG-009", name: "Triplek 9mm", qty: 95, revenue: 11_400_000 },
  { sku: "BRG-007", name: "Besi Hollow 4x4", qty: 88, revenue: 9_240_000 },
];

export type PaymentMethod = "Tunai" | "QRIS" | "Transfer" | "Piutang";

export interface Transaction {
  id: string;
  invoice: string;
  date: string;
  cashier: string;
  customer?: string;
  items: number;
  total: number;
  method: PaymentMethod;
  status: "completed" | "void";
}

export const RECENT_TRANSACTIONS: Transaction[] = [
  { id: "t1", invoice: "TRX-2026-1042", date: daysAgo(0), cashier: "Andi Pratama", items: 4, total: 875_000, method: "Tunai", status: "completed" },
  { id: "t2", invoice: "TRX-2026-1043", date: daysAgo(0), cashier: "Andi Pratama", customer: "PT Sentosa Properti", items: 12, total: 4_320_000, method: "Transfer", status: "completed" },
  { id: "t3", invoice: "TRX-2026-1044", date: daysAgo(0), cashier: "Siti Rahma", items: 2, total: 220_000, method: "QRIS", status: "completed" },
  { id: "t4", invoice: "TRX-2026-1045", date: daysAgo(0), cashier: "Andi Pratama", customer: "Toko Pak Budi", items: 8, total: 1_650_000, method: "Piutang", status: "completed" },
  { id: "t5", invoice: "TRX-2026-1046", date: daysAgo(0), cashier: "Siti Rahma", items: 1, total: 65_000, method: "Tunai", status: "completed" },
  { id: "t6", invoice: "TRX-2026-1041", date: daysAgo(1), cashier: "Andi Pratama", items: 6, total: 1_240_000, method: "Tunai", status: "completed" },
  { id: "t7", invoice: "TRX-2026-1040", date: daysAgo(1), cashier: "Siti Rahma", items: 3, total: 520_000, method: "QRIS", status: "void" },
];

// Stock movement history (for product detail)
export interface StockMovement {
  date: string;
  sku: string;
  type: "in" | "out" | "adjust";
  qty: number;
  ref: string;
  note: string;
}

export const STOCK_MOVEMENTS: StockMovement[] = [
  { date: daysAgo(0), sku: "BRG-003", type: "out", qty: 2, ref: "TRX-2026-1042", note: "Penjualan kasir Andi" },
  { date: daysAgo(1), sku: "BRG-003", type: "out", qty: 3, ref: "TRX-2026-1038", note: "Penjualan kasir Siti" },
  { date: daysAgo(2), sku: "BRG-003", type: "out", qty: 5, ref: "TRX-2026-1031", note: "Penjualan kasir Andi" },
  { date: daysAgo(5), sku: "BRG-003", type: "in", qty: 10, ref: "GR-2026-0091", note: "Penerimaan dari PT Avia Avian" },
  { date: daysAgo(0), sku: "BRG-001", type: "out", qty: 12, ref: "TRX-2026-1043", note: "Penjualan ke PT Sentosa" },
  { date: daysAgo(3), sku: "BRG-001", type: "in", qty: 50, ref: "GR-2026-0089", note: "Penerimaan dari Indocement" },
];

// Cash & bank accounts
export const CASH_ACCOUNTS = [
  { id: "k1", name: "Kas Kasir", type: "cash" as const, balance: 8_400_000 },
  { id: "k2", name: "Kas Brankas", type: "cash" as const, balance: 12_000_000 },
  { id: "b1", name: "BCA - 1234567890", type: "bank" as const, balance: 42_500_000 },
  { id: "b2", name: "Mandiri - 9876543210", type: "bank" as const, balance: 13_900_000 },
];

export interface CashEntry {
  id: string;
  date: string;
  description: string;
  account: string;
  category: string;
  amount: number; // positive = in, negative = out
}

export const CASH_BOOK: CashEntry[] = [
  { id: "ce1", date: daysAgo(0), description: "Penjualan tunai TRX-2026-1042", account: "Kas Kasir", category: "Penjualan", amount: 875_000 },
  { id: "ce2", date: daysAgo(0), description: "Transfer dari PT Sentosa", account: "BCA - 1234567890", category: "Penjualan", amount: 4_320_000 },
  { id: "ce3", date: daysAgo(0), description: "QRIS hari ini", account: "BCA - 1234567890", category: "Penjualan", amount: 285_000 },
  { id: "ce4", date: daysAgo(0), description: "Bayar listrik PLN", account: "BCA - 1234567890", category: "Utilitas", amount: -1_250_000 },
  { id: "ce5", date: daysAgo(1), description: "Gaji harian buruh angkut", account: "Kas Kasir", category: "Operasional", amount: -350_000 },
  { id: "ce6", date: daysAgo(1), description: "Penjualan tunai harian", account: "Kas Kasir", category: "Penjualan", amount: 3_200_000 },
  { id: "ce7", date: daysAgo(2), description: "Bayar supplier PT Avia", account: "BCA - 1234567890", category: "Pembelian", amount: -6_800_000 },
  { id: "ce8", date: daysAgo(3), description: "Setor ke bank", account: "BCA - 1234567890", category: "Setoran", amount: 10_000_000 },
  { id: "ce9", date: daysAgo(3), description: "Setor ke bank (dari kas)", account: "Kas Kasir", category: "Setoran", amount: -10_000_000 },
];

// Financial summary (consistent with PRD)
export const FINANCE_SUMMARY = {
  monthSales: 125_000_000,
  monthCogs: 85_000_000,
  monthGrossProfit: 40_000_000,
  monthOpex: 12_000_000,
  monthNetProfit: 28_000_000,
  totalReceivables: RECEIVABLES.reduce((s, r) => s + (r.amount - r.paid), 0),
  totalPayables: PAYABLES.reduce((s, p) => s + (p.amount - p.paid), 0),
  totalCash: CASH_ACCOUNTS.reduce((s, a) => s + a.balance, 0),
};

// Purchase Orders
export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  date: string;
  status: "draft" | "sent" | "received" | "partial";
  items: { sku: string; name: string; qty: number; price: number }[];
}

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "po1", number: "PO-2026-0145", supplierId: "s1", date: daysAgo(2), status: "sent",
    items: [{ sku: "BRG-001", name: "Semen Portland 50kg", qty: 100, price: 57000 }],
  },
  {
    id: "po2", number: "PO-2026-0144", supplierId: "s3", date: daysAgo(5), status: "received",
    items: [
      { sku: "BRG-003", name: "Cat Tembok Putih 5kg", qty: 20, price: 38000 },
      { sku: "BRG-008", name: "Cat Besi Hitam 1kg", qty: 24, price: 28000 },
    ],
  },
  {
    id: "po3", number: "PO-2026-0143", supplierId: "s4", date: daysAgo(8), status: "partial",
    items: [{ sku: "BRG-007", name: "Besi Hollow 4x4", qty: 50, price: 85000 }],
  },
  {
    id: "po4", number: "PO-2026-0146", supplierId: "s2", date: daysAgo(0), status: "draft",
    items: [{ sku: "BRG-002", name: "Bata Merah", qty: 5000, price: 800 }],
  },
];

export const BRANCHES = [
  { id: "br1", name: "Sudirman, Jakarta", isMain: true },
  { id: "br2", name: "Bekasi Timur", isMain: false },
  { id: "br3", name: "Tangerang Selatan", isMain: false },
];

/**
 * UAT — Dashboard margin selaras dengan Histori Penjualan
 * Run: npx tsx scripts/uat-dashboard-margin-runner.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(join(root, ".env"));

import { getDb } from "../src/server/db/index.ts";
import { createSaleTransaction } from "../src/server/services/transactions.ts";
import { getDashboardStatsReport } from "../src/server/services/reports.ts";
import { listSalesHistoryForBranches } from "../src/server/services/transactions.ts";
import { mapSalesHistoryToRecord } from "../src/lib/map-sales-transaction.ts";
import {
  computeTransactionMargin,
  computeTransactionsMarginSummary,
} from "../src/lib/sales-margin.ts";
import {
  authUsers,
  branchProducts,
  branches,
  cashierSessions,
  cashAccounts,
  cashTransactions,
  customers,
  products,
  profiles,
  tenants,
} from "../src/server/db/schema.ts";

const suffix = Date.now().toString(36);
const tenantId = randomUUID();
const branchId = randomUUID();
const userId = randomUUID();
const productId = randomUUID();
const customerId = randomUUID();
const sessionId = randomUUID();
const cashAccountId = randomUUID();

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function filterToday<T extends { createdAt: string }>(rows: T[]): T[] {
  const today = localDateKey(new Date());
  return rows.filter((r) => localDateKey(new Date(r.createdAt)) === today);
}

async function seed() {
  const db = getDb();
  const hash = await bcrypt.hash("123456", 10);

  await db.insert(tenants).values({
    id: tenantId,
    name: "UAT Dashboard Margin",
    slug: `uat-dash-${suffix}`,
    ownerEmail: `dash-${suffix}@test.local`,
    plan: "trial",
    isActive: true,
    onboardingComplete: true,
  });

  await db.insert(branches).values({
    id: branchId,
    tenantId,
    code: "DASH",
    name: "Dash Branch",
    isActive: true,
  });

  await db.insert(authUsers).values({
    id: userId,
    email: `dash-${suffix}@test.local`,
    username: `dash.${suffix}`,
    passwordHash: hash,
    tenantId,
  });

  await db.insert(profiles).values({
    id: userId,
    tenantId,
    name: "Owner Dash",
    email: `dash-${suffix}@test.local`,
    role: "owner",
    isActive: true,
  });

  await db.insert(products).values({
    id: productId,
    tenantId,
    sku: "DASH-01",
    name: "Produk Dash",
    unit: "pcs",
    purchasePrice: 100_000,
    isActive: true,
  });

  await db.insert(branchProducts).values({
    id: randomUUID(),
    tenantId,
    branchId,
    productId,
    sellingPrice: 150_000,
    stock: 100,
    legacyStock: 0,
    reorderPoint: 5,
  });

  await db.insert(customers).values({
    id: customerId,
    tenantId,
    name: "Pelanggan Dash",
    phone: "08123",
    creditLimit: 5_000_000,
    outstandingDebt: 0,
  });

  await db.insert(cashierSessions).values({
    id: sessionId,
    tenantId,
    branchId,
    cashierId: userId,
    status: "open",
    openingCashBalance: 0,
    expectedCashBalance: 0,
    totalSales: 0,
    totalTransactions: 0,
    totalCashSales: 0,
    totalCardSales: 0,
    totalTransferSales: 0,
    totalCreditSales: 0,
  });

  await db.insert(cashAccounts).values({
    id: cashAccountId,
    tenantId,
    branchId,
    name: "Kas UAT",
    type: "cash",
    balance: 1_000_000,
    isActive: true,
  });
}

async function cleanup() {
  const db = getDb();
  await db.delete(tenants).where(eq(tenants.id, tenantId));
}

async function main() {
  console.log("\n=== UAT Dashboard Margin vs Histori Penjualan ===\n");
  await seed();

  // Penjualan reguler: margin +100.000 (150k - 100k) × 2 = 100.000
  await createSaleTransaction(
    tenantId,
    {
      branch_id: branchId,
      session_id: sessionId,
      payment_method: "cash",
      status: "completed",
      subtotal: 300_000,
      discount_amount: 0,
      grand_total: 300_000,
      amount_paid: 300_000,
      change_amount: 0,
      paid_by: userId,
      client_tx_id: `dash-reg-${suffix}`,
    },
    [
      {
        product_id: productId,
        product_name: "Produk Dash",
        sku: "DASH-01",
        unit: "pcs",
        qty: 2,
        purchase_price: 100_000,
        selling_price: 150_000,
        discount: 0,
        subtotal: 300_000,
        stock_source: "verified",
      },
    ],
  );

  // Penjualan dengan baris SO: grandTotal tinggi, margin hanya dari baris stok (1 × 50k)
  const soGrandTotal = 10 * 150_000 + 150_000;
  await createSaleTransaction(
    tenantId,
    {
      branch_id: branchId,
      session_id: sessionId,
      payment_method: "cash",
      status: "completed",
      subtotal: soGrandTotal,
      discount_amount: 0,
      grand_total: soGrandTotal,
      amount_paid: soGrandTotal,
      change_amount: 0,
      paid_by: userId,
      client_tx_id: `dash-so-${suffix}`,
    },
    [
      {
        product_id: productId,
        product_name: "Produk Dash",
        sku: "DASH-01",
        unit: "pcs",
        qty: 10,
        purchase_price: 100_000,
        selling_price: 150_000,
        discount: 0,
        subtotal: 1_500_000,
        stock_source: "verified",
        is_so_line: true,
      },
      {
        product_id: productId,
        product_name: "Produk Dash",
        sku: "DASH-01",
        unit: "pcs",
        qty: 1,
        purchase_price: 100_000,
        selling_price: 150_000,
        discount: 0,
        subtotal: 150_000,
        stock_source: "verified",
        is_so_line: false,
      },
    ],
    {
      salesOrder: {
        customer_id: customerId,
        customer_name: "Pelanggan SO",
        delivery_address: "Jl. SO UAT",
        discount_amount: 0,
        down_payment: 1_500_000,
        created_by: userId,
        pos_transaction_number: "pending",
        items: [
          {
            product_id: productId,
            product_name: "Produk Dash",
            sku: "DASH-01",
            unit: "pcs",
            qty: 10,
            selling_price: 150_000,
            discount: 0,
          },
        ],
      },
    },
  );

  // Biaya operasional hari ini
  const db = getDb();
  await db.insert(cashTransactions).values({
    id: randomUUID(),
    tenantId,
    branchId,
    cashAccountId,
    type: "expense",
    category: "Operasional",
    amount: 75_000,
    description: "Biaya UAT",
    reference: `UAT-OPEX-${suffix}`,
    userId,
  });

  const dashboard = await getDashboardStatsReport(tenantId, branchId);
  const historyRaw = await listSalesHistoryForBranches(tenantId, [branchId], 500);
  const historyRecords = historyRaw.map(mapSalesHistoryToRecord);
  const todayHistory = filterToday(historyRecords);
  const historySummary = computeTransactionsMarginSummary(todayHistory);

  const expectedRevenue = todayHistory
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + t.grandTotal, 0);
  const expectedMargin = todayHistory
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + computeTransactionMargin(t), 0);

  console.log("Periode: Hari Ini (tanggal lokal)\n");
  console.log(`  Dashboard revenue     : ${dashboard.todayRevenue}`);
  console.log(`  Histori revenue     : ${expectedRevenue}`);
  console.log(`  Dashboard gross     : ${dashboard.todayGrossProfit}`);
  console.log(`  Histori margin      : ${expectedMargin}`);
  console.log(`  Dashboard net       : ${dashboard.todayNetProfit}`);
  console.log(`  Dashboard opex      : ${dashboard.todayOpex}\n`);

  assert(dashboard.todayRevenue === expectedRevenue, "Penjualan dashboard = histori (grandTotal)");
  assert(
    dashboard.todayGrossProfit === expectedMargin,
    "Keuntungan dashboard = margin histori (tanpa baris SO)",
  );
  assert(
    historySummary.totalMargin === expectedMargin,
    "computeTransactionsMarginSummary konsisten",
  );
  assert(
    dashboard.todayGrossProfit === 150_000,
    "Margin hanya dari baris stok (100k + 50k), SO diabaikan",
  );
  assert(dashboard.todayOpex === 75_000, "Biaya operasional terhitung");
  assert(
    dashboard.todayNetProfit === dashboard.todayGrossProfit - dashboard.todayOpex,
    "Laba bersih = keuntungan − opex",
  );
  assert(dashboard.todayTransactions === 2, "2 transaksi hari ini");

  // Pastikan baris SO tidak membuat margin negatif
  assert(dashboard.todayGrossProfit > 0, "Margin tidak negatif meski ada baris SO");

  console.log(`\n=== Hasil: ${passed} passed, ${failed} failed ===\n`);
  await cleanup();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await cleanup();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

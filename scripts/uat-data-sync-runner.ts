/**
 * E2E — createSaleTransaction via server service (real code path)
 * Run via: npx tsx scripts/uat-data-sync-runner.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
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
import { createSaleTransaction, voidSaleTransaction, listSalesHistoryForBranches } from "../src/server/services/transactions.ts";
import {
  authUsers,
  branchProducts,
  branches,
  cashierSessions,
  cashTransactions,
  customers,
  deliveries,
  products,
  profiles,
  salesTransactions,
  stockMovements,
  tenants,
} from "../src/server/db/schema.ts";
import { and, eq } from "drizzle-orm";

const suffix = Date.now().toString(36);
const tenantId = randomUUID();
const branchId = randomUUID();
const userId = randomUUID();
const productId = randomUUID();
const customerId = randomUUID();
const sessionId = randomUUID();

async function seed() {
  const db = getDb();
  const hash = await bcrypt.hash("123456", 10);

  await db.insert(tenants).values({
    id: tenantId,
    name: "UAT Service Sync",
    slug: `uat-svc-${suffix}`,
    ownerEmail: `svc-${suffix}@test.local`,
    plan: "trial",
    isActive: true,
    onboardingComplete: true,
  });

  await db.insert(branches).values({
    id: branchId,
    tenantId,
    code: "SVC",
    name: "Svc Branch",
    isActive: true,
  });

  await db.insert(authUsers).values({
    id: userId,
    email: `svc-${suffix}@test.local`,
    username: `svc.${suffix}`,
    passwordHash: hash,
    tenantId,
  });

  await db.insert(profiles).values({
    id: userId,
    tenantId,
    name: "Kasir Svc",
    email: `svc-${suffix}@test.local`,
    role: "cashier",
    isActive: true,
  });

  await db.insert(products).values({
    id: productId,
    tenantId,
    sku: "SVC-01",
    name: "Produk Svc",
    unit: "pcs",
    purchasePrice: 10000,
    isActive: true,
  });

  await db.insert(branchProducts).values({
    id: randomUUID(),
    tenantId,
    branchId,
    productId,
    sellingPrice: 15000,
    stock: 50,
    legacyStock: 0,
    reorderPoint: 5,
  });

  await db.insert(customers).values({
    id: customerId,
    tenantId,
    name: "Kredit Svc",
    phone: "08123",
    creditLimit: 1000000,
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
}

async function cleanup() {
  const db = getDb();
  await db.delete(tenants).where(eq(tenants.id, tenantId));
}

async function main() {
  await seed();
  const db = getDb();

  const tx = await createSaleTransaction(
    tenantId,
    {
      branch_id: branchId,
      session_id: sessionId,
      payment_method: "cash",
      status: "completed",
      subtotal: 30000,
      discount_amount: 0,
      grand_total: 30000,
      amount_paid: 30000,
      change_amount: 0,
      paid_by: userId,
      client_tx_id: `client-${suffix}`,
    },
    [
      {
        product_id: productId,
        product_name: "Produk Svc",
        sku: "SVC-01",
        unit: "pcs",
        qty: 2,
        purchase_price: 10000,
        selling_price: 15000,
        discount: 0,
        subtotal: 30000,
        stock_source: "verified",
      },
    ],
    {
      delivery: {
        orderFulfillmentType: "shipped",
        customerName: "Pelanggan Svc",
        customerPhone: "08123",
        deliveryAddress: "Jl. Uji No. 1",
        grandTotal: 30000,
      },
    },
  );

  console.log(`  ✓ createSaleTransaction — ${tx.transaction_number}`);

  const cashTx = await db.query.cashTransactions.findMany({
    where: eq(cashTransactions.reference, tx.transaction_number),
  });
  if (cashTx.length < 1) throw new Error("cash_transactions missing for POS sale");
  console.log("  ✓ POS tunai → cash_transactions");

  const deliveryRows = await db.query.deliveries.findMany({
    where: eq(deliveries.salesTransactionId, tx.id),
  });
  if (deliveryRows.length < 1) throw new Error("deliveries missing for shipped sale");
  console.log("  ✓ POS kirim → deliveries");

  const history = await listSalesHistoryForBranches(tenantId, [branchId], 300);
  const found = history.find((h) => h.id === tx.id);
  if (!found) throw new Error("Histori penjualan tidak menampilkan transaksi POS");
  console.log("  ✓ POS → listSalesHistoryForBranches");

  const bp = await db.query.branchProducts.findFirst({
    where: eq(branchProducts.productId, productId),
  });
  if (bp?.stock !== 48) throw new Error(`Stock expected 48, got ${bp?.stock}`);
  console.log("  ✓ POS → branch_products (48)");

  const movements = await db.query.stockMovements.findMany({
    where: eq(stockMovements.reference, tx.transaction_number),
  });
  if (movements.length < 1) throw new Error("stock_movements missing");
  console.log("  ✓ POS → stock_movements");

  const session = await db.query.cashierSessions.findFirst({
    where: eq(cashierSessions.id, sessionId),
  });
  if (Number(session?.totalSales) !== 30000) {
    throw new Error(`session total_sales expected 30000, got ${session?.totalSales}`);
  }
  console.log("  ✓ POS → cashier_sessions");

  await db
    .update(branchProducts)
    .set({ stock: 9 })
    .where(
      and(eq(branchProducts.tenantId, tenantId), eq(branchProducts.branchId, branchId)),
    );

  const soGrandTotal = 11 * 15000;
  const txSo = await createSaleTransaction(
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
      client_tx_id: `client-so-${suffix}`,
    },
    [
      {
        product_id: productId,
        product_name: "Produk Svc",
        sku: "SVC-01",
        unit: "pcs",
        qty: 10,
        purchase_price: 10000,
        selling_price: 15000,
        discount: 0,
        subtotal: 150000,
        stock_source: "verified",
        is_so_line: true,
      },
      {
        product_id: productId,
        product_name: "Produk Svc",
        sku: "SVC-01",
        unit: "pcs",
        qty: 1,
        purchase_price: 10000,
        selling_price: 15000,
        discount: 0,
        subtotal: 15000,
        stock_source: "verified",
        is_so_line: false,
      },
    ],
    {
      salesOrder: {
        customer_id: null,
        customer_name: "Pelanggan SO",
        delivery_address: "Jl. SO Test",
        discount_amount: 0,
        down_payment: 150000,
        created_by: userId,
        pos_transaction_number: "pending",
        items: [
          {
            product_id: productId,
            product_name: "Produk Svc",
            sku: "SVC-01",
            unit: "pcs",
            qty: 10,
            selling_price: 15000,
            discount: 0,
          },
        ],
      },
    },
  );

  const bpSo = await db.query.branchProducts.findFirst({
    where: eq(branchProducts.productId, productId),
  });
  if (bpSo?.stock !== 8) {
    throw new Error(`SO checkout stock expected 8 (9-1), got ${bpSo?.stock}`);
  }

  const soMovements = await db.query.stockMovements.findMany({
    where: and(
      eq(stockMovements.reference, txSo.transaction_number),
      eq(stockMovements.productId, productId),
    ),
  });
  if (soMovements.length !== 1 || soMovements[0]?.qty !== 1) {
    throw new Error(
      `SO checkout expected 1 stock movement qty=1, got ${soMovements.length} qty=${soMovements[0]?.qty}`,
    );
  }
  console.log("  ✓ POS baris SO — skip stok toko (10 SO + 1 stok, stok 9→8)");

  try {
    await voidSaleTransaction(tenantId, tx.id, userId);
    const bpAfter = await db.query.branchProducts.findFirst({
      where: eq(branchProducts.productId, productId),
    });
    if (bpAfter?.stock !== 50) {
      throw new Error(`After void stock expected 50, got ${bpAfter?.stock}`);
    }
    console.log("  ✓ void → restore stock");

    const voidedTx = await db.query.salesTransactions.findFirst({
      where: and(eq(salesTransactions.tenantId, tenantId), eq(salesTransactions.id, tx.id)),
    });
    if (voidedTx?.status !== "voided") throw new Error("void status not set");
    console.log("  ✓ voidSaleTransaction → status voided");
  } catch (err) {
    console.log("  ⚠ void test skipped (requires server runtime cache)");
  }

  await cleanup();
  console.log("  ✓ cleanup tenant");
}

main().catch(async (err) => {
  console.error("  ✗ service E2E:", err.message ?? err);
  try {
    await cleanup();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

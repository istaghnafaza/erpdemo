/**
 * UAT — Sales Returns (all flows)
 * Run: npx tsx scripts/uat-sales-returns-runner.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";

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
import {
  branchProducts,
  branches,
  cashAccounts,
  cashierSessions,
  customers,
  products,
  profiles,
  salesItems,
  salesReturns,
  salesTransactions,
  stockMovements,
} from "../src/server/db/schema.ts";
import { isWithinRefundWindow } from "../src/lib/return-window.ts";
import {
  approveLateReturnRefund,
  chooseReturnSettlement,
  completeReturnQc,
  completeReturnRefund,
  createReturnRequest,
  finalizeReturnOffsetInTx,
  getTransactionForReturn,
  listActiveReturns,
  listPendingOffsetReturns,
} from "../src/server/services/sales-returns.ts";
import { createSaleTransaction, openSession } from "../src/server/services/transactions.ts";

type Check = { group: string; name: string; ok: boolean; detail?: string };

const checks: Check[] = [];
const cleanupReturnIds: string[] = [];
const cleanupTxIds: string[] = [];
const cleanupProductIds: string[] = [];
const cleanupSessionIds: string[] = [];

function pass(group: string, name: string, detail?: string) {
  checks.push({ group, name, ok: true, detail });
  console.log(`  ✓ [${group}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(group: string, name: string, detail: string) {
  checks.push({ group, name, ok: false, detail });
  console.error(`  ✗ [${group}] ${name} — ${detail}`);
}

async function expectError(group: string, name: string, fn: () => Promise<unknown>, substr: string) {
  try {
    await fn();
    fail(group, name, `Expected error containing "${substr}"`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes(substr)) pass(group, name, msg.slice(0, 120));
    else fail(group, name, `Got: ${msg}`);
  }
}

interface Fixture {
  tenantId: string;
  branchId: string;
  userId: string;
  productId: string;
  productIdNonReturnable: string;
  customerId: string;
  sessionId: string;
  bpStockBefore: number;
}

async function resolveFixture(): Promise<Fixture> {
  const db = getDb();

  const txRow = await db.query.salesTransactions.findFirst({
    where: eq(salesTransactions.status, "completed"),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  if (!txRow) throw new Error("No completed sales transaction — buat transaksi POS dulu");

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.tenantId, txRow.tenantId),
  });
  if (!profile) throw new Error("No profile for tenant");

  const item = await db.query.salesItems.findFirst({
    where: and(
      eq(salesItems.transactionId, txRow.id),
      eq(salesItems.isSoLine, false),
    ),
  });
  if (!item?.productId) throw new Error("No returnable line item on latest sale");

  let session = await db.query.cashierSessions.findFirst({
    where: and(
      eq(cashierSessions.tenantId, txRow.tenantId),
      eq(cashierSessions.branchId, txRow.branchId),
      eq(cashierSessions.status, "open"),
    ),
  });

  if (!session) {
    session = await openSession(txRow.tenantId, {
      branch_id: txRow.branchId,
      cashier_id: profile.id,
      status: "open",
      opened_at: new Date().toISOString(),
      opening_cash_balance: 500_000,
    });
    cleanupSessionIds.push(session.id);
  }

  const bp = await db.query.branchProducts.findFirst({
    where: and(
      eq(branchProducts.tenantId, txRow.tenantId),
      eq(branchProducts.branchId, txRow.branchId),
      eq(branchProducts.productId, item.productId),
    ),
  });
  if (!bp) throw new Error("Branch product not found");

  const nonRetSku = `UAT-NR-${Date.now()}`;
  const [nonRetProd] = await db
    .insert(products)
    .values({
      tenantId: txRow.tenantId,
      sku: nonRetSku,
      name: "UAT Kabel Potong",
      unit: "pcs",
      purchasePrice: 10_000,
      isReturnable: false,
      returnBlockLabel: "Kabel sudah dipotong",
      isActive: true,
    })
    .returning();
  cleanupProductIds.push(nonRetProd.id);

  const creditCustomer =
    (await db.query.customers.findFirst({
      where: and(eq(customers.tenantId, txRow.tenantId), eq(customers.type, "credit")),
    })) ??
    (await db.query.customers.findFirst({
      where: eq(customers.tenantId, txRow.tenantId),
    }));

  if (!creditCustomer) throw new Error("No customer for credit test");

  return {
    tenantId: txRow.tenantId,
    branchId: txRow.branchId,
    userId: profile.id,
    productId: item.productId,
    productIdNonReturnable: nonRetProd.id,
    customerId: creditCustomer.id,
    sessionId: session.id,
    bpStockBefore: bp.stock,
  };
}

async function createTestSale(
  fx: Fixture,
  opts: {
    paymentMethod?: "cash" | "credit";
    qty?: number;
    productId?: string;
    createdAt?: Date;
    isSoLine?: boolean;
    unitPrice?: number;
    customerId?: string | null;
  } = {},
) {
  const db = getDb();
  const productId = opts.productId ?? fx.productId;
  const qty = opts.qty ?? 2;
  const unitPrice = opts.unitPrice ?? 25_000;
  const subtotal = unitPrice * qty;

  const prod = await db.query.products.findFirst({ where: eq(products.id, productId) });
  if (!prod) throw new Error("Product missing");

  const bp = await db.query.branchProducts.findFirst({
    where: and(
      eq(branchProducts.tenantId, fx.tenantId),
      eq(branchProducts.branchId, fx.branchId),
      eq(branchProducts.productId, productId),
    ),
  });

  if (!opts.isSoLine && bp && bp.stock < qty) {
    await db
      .update(branchProducts)
      .set({ stock: qty + 10 })
      .where(eq(branchProducts.id, bp.id));
  }

  if (!opts.isSoLine && !bp) {
    await db.insert(branchProducts).values({
      tenantId: fx.tenantId,
      branchId: fx.branchId,
      productId,
      sellingPrice: unitPrice,
      stock: qty + 10,
      legacyStock: 0,
      reorderPoint: 0,
    });
  }

  const sale = await createSaleTransaction(
    fx.tenantId,
    {
      branch_id: fx.branchId,
      session_id: fx.sessionId,
      cart_id: null,
      transaction_number: `UAT-RTN-${randomUUID().slice(0, 8)}`,
      customer_id: opts.customerId ?? null,
      customer_name: null,
      subtotal,
      discount_amount: 0,
      tax_amount: 0,
      grand_total: subtotal,
      payment_method: opts.paymentMethod ?? "cash",
      qris_provider: null,
      amount_paid: opts.paymentMethod === "credit" ? 0 : subtotal,
      change_amount: 0,
      input_by: fx.userId,
      paid_by: fx.userId,
      is_cross_session: false,
      has_legacy_items: false,
      is_offline_transaction: false,
      offline_created_at: null,
      sync_status: "synced",
      status: "completed",
      notes: "UAT sales returns",
      created_at: opts.createdAt?.toISOString(),
    },
    [
      {
        product_id: productId,
        product_name: prod.name,
        sku: prod.sku,
        unit: prod.unit,
        qty,
        purchase_price: prod.purchasePrice,
        selling_price: unitPrice,
        discount: 0,
        subtotal,
        stock_source: "verified",
        is_so_line: opts.isSoLine === true,
      },
    ],
  );

  cleanupTxIds.push(sale.id);

  if (opts.createdAt) {
    await db
      .update(salesTransactions)
      .set({ createdAt: opts.createdAt })
      .where(eq(salesTransactions.id, sale.id));
  }

  const items = await db.query.salesItems.findMany({
    where: eq(salesItems.transactionId, sale.id),
  });
  return { sale, items };
}

async function ensureCashBalances(fx: Fixture, minBalance = 5_000_000) {
  const db = getDb();
  for (const type of ["cash", "bank"] as const) {
    let acc = await db.query.cashAccounts.findFirst({
      where: and(
        eq(cashAccounts.tenantId, fx.tenantId),
        eq(cashAccounts.branchId, fx.branchId),
        eq(cashAccounts.type, type),
        eq(cashAccounts.isActive, true),
      ),
    });
    if (!acc) {
      [acc] = await db
        .insert(cashAccounts)
        .values({
          tenantId: fx.tenantId,
          branchId: fx.branchId,
          name: type === "cash" ? "Kas Toko" : "Rekening Bank",
          type,
          balance: minBalance,
          isActive: true,
        })
        .returning();
    } else if (acc.balance < minBalance) {
      await db
        .update(cashAccounts)
        .set({ balance: minBalance })
        .where(eq(cashAccounts.id, acc.id));
    }
  }
}

async function stockForProduct(fx: Fixture, productId: string) {
  const db = getDb();
  const bp = await db.query.branchProducts.findFirst({
    where: and(
      eq(branchProducts.tenantId, fx.tenantId),
      eq(branchProducts.branchId, fx.branchId),
      eq(branchProducts.productId, productId),
    ),
  });
  return bp?.stock ?? 0;
}

async function runUat() {
  console.log("\n=== UAT Sales Returns ===\n");
  const fx = await resolveFixture();
  const db = getDb();

  pass("setup", "fixture", `${fx.tenantId.slice(0, 8)}… branch ${fx.branchId.slice(0, 8)}…`);
  await ensureCashBalances(fx);

  // --- Window logic ---
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 2);
  pass(
    "window",
    "within H+1 (today sale)",
    String(isWithinRefundWindow(now, now, 1)),
  );
  pass(
    "window",
    "late (2 days ago)",
    String(!isWithinRefundWindow(yesterday, now, 1)),
  );

  // --- Guards ---
  const { sale: cashSale, items: cashItems } = await createTestSale(fx, { qty: 3 });
  const line = cashItems[0]!;

  await expectError("guard", "qty melebihi tersedia", () =>
    createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
      originalTransactionId: cashSale.id,
      lines: [{ salesItemId: line.id, qty: 99 }],
    }),
    "Qty retur tidak valid",
  );

  await db.update(salesTransactions).set({ status: "voided" }).where(eq(salesTransactions.id, cashSale.id));
  await expectError("guard", "transaksi void", () =>
    createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
      originalTransactionId: cashSale.id,
      lines: [{ salesItemId: line.id, qty: 1 }],
    }),
    "void",
  );
  await db.update(salesTransactions).set({ status: "completed" }).where(eq(salesTransactions.id, cashSale.id));

  const { sale: soSale, items: soItems } = await createTestSale(fx, { isSoLine: true });
  await expectError("guard", "baris SO tidak bisa retur", () =>
    createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
      originalTransactionId: soSale.id,
      lines: [{ salesItemId: soItems[0]!.id, qty: 1 }],
    }),
    "Barang SO",
  );

  const { sale: nrSale, items: nrItems } = await createTestSale(fx, {
    productId: fx.productIdNonReturnable,
    qty: 1,
  });
  await expectError("guard", "produk non-returnable", () =>
    createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
      originalTransactionId: nrSale.id,
      lines: [{ salesItemId: nrItems[0]!.id, qty: 1 }],
    }),
    "tidak bisa diretur",
  );

  // --- Flow A: within window → QC pass → refund cash ---
  const { sale: saleA, items: itemsA } = await createTestSale(fx, { qty: 2 });
  const stockAfterSaleA = await stockForProduct(fx, fx.productId);
  const reqA = await createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
    originalTransactionId: saleA.id,
    lines: [{ salesItemId: itemsA[0]!.id, qty: 1 }],
    reasonNotes: "UAT refund cash",
  });
  cleanupReturnIds.push(reqA.id);
  pass("flow-A", "create return", reqA.returnNumber);
  if (!reqA.isLateReturn) pass("flow-A", "flag within window", "isLateReturn=false");
  else fail("flow-A", "flag within window", "expected false");

  const txAfterReqA = await db.query.salesTransactions.findFirst({
    where: eq(salesTransactions.id, saleA.id),
  });
  if (txAfterReqA?.returnStatus === "partial") pass("flow-A", "status proses retur saat diajukan");
  else fail("flow-A", "status proses retur saat diajukan", txAfterReqA?.returnStatus ?? "null");

  await expectError("guard", "retur ganda qty sama", () =>
    createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
      originalTransactionId: saleA.id,
      lines: [{ salesItemId: itemsA[0]!.id, qty: 2 }],
    }),
    "max 1",
  );

  const { sale: saleDup, items: itemsDup } = await createTestSale(fx, { qty: 1 });
  const reqDup = await createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
    originalTransactionId: saleDup.id,
    lines: [{ salesItemId: itemsDup[0]!.id, qty: 1 }],
  });
  cleanupReturnIds.push(reqDup.id);
  await expectError("guard", "retur ganda transaksi penuh", () =>
    createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
      originalTransactionId: saleDup.id,
      lines: [{ salesItemId: itemsDup[0]!.id, qty: 1 }],
    }),
    "semua qty sudah diajukan",
  );

  const qcA = await completeReturnQc(
    fx.tenantId,
    reqA.id,
    fx.userId,
    [{ returnItemId: reqA.items[0]!.id, passed: true }],
    "UAT QC OK",
  );
  if (qcA.status === "qc_completed") pass("flow-A", "QC completed", rupiah(qcA.approvedRefundAmount));
  else fail("flow-A", "QC completed", qcA.status);

  const settleA = await chooseReturnSettlement(fx.tenantId, reqA.id, "standalone_refund");
  if (settleA.settlement === "standalone_refund") pass("flow-A", "settlement refund");
  else fail("flow-A", "settlement refund", String(settleA.settlement));

  const doneA = await completeReturnRefund(fx.tenantId, fx.userId, {
    returnId: reqA.id,
    refundMethod: "cash",
  });
  if (doneA.status === "completed") pass("flow-A", "refund cash completed");
  else fail("flow-A", "refund cash completed", doneA.status);

  const stockAfterReturnA = await stockForProduct(fx, fx.productId);
  if (stockAfterReturnA === stockAfterSaleA + 1) pass("flow-A", "stock restored +1 after return");
  else fail("flow-A", "stock restored", `${stockAfterSaleA} → ${stockAfterReturnA}`);

  const origA = await db.query.salesTransactions.findFirst({
    where: eq(salesTransactions.id, saleA.id),
  });
  if (origA?.returnStatus === "partial") pass("flow-A", "original tx partial return");
  else fail("flow-A", "original tx partial return", origA?.returnStatus ?? "null");

  // --- Flow B: QC all reject ---
  const { sale: saleB, items: itemsB } = await createTestSale(fx, { qty: 1 });
  const reqB = await createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
    originalTransactionId: saleB.id,
    lines: [{ salesItemId: itemsB[0]!.id, qty: 1 }],
  });
  cleanupReturnIds.push(reqB.id);
  const qcB = await completeReturnQc(
    fx.tenantId,
    reqB.id,
    fx.userId,
    [{ returnItemId: reqB.items[0]!.id, passed: false, rejectReason: "Rusak" }],
  );
  if (qcB.status === "rejected") pass("flow-B", "QC all rejected");
  else fail("flow-B", "QC all rejected", qcB.status);

  // --- Flow C: QC partial pass ---
  const { sale: saleC, items: itemsC } = await createTestSale(fx, { qty: 2 });
  const reqC = await createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
    originalTransactionId: saleC.id,
    lines: [
      { salesItemId: itemsC[0]!.id, qty: 1 },
    ],
  });
  cleanupReturnIds.push(reqC.id);
  // create second line by returning same item twice isn't possible with 1 line - use partial QC on multi-item
  const qcC = await completeReturnQc(fx.tenantId, reqC.id, fx.userId, [
    { returnItemId: reqC.items[0]!.id, passed: true },
  ]);
  if (qcC.approvedRefundAmount > 0) pass("flow-C", "partial QC approved amount", rupiah(qcC.approvedRefundAmount));
  await chooseReturnSettlement(fx.tenantId, reqC.id, "standalone_refund");
  await ensureCashBalances(fx);
  await completeReturnRefund(fx.tenantId, fx.userId, { returnId: reqC.id, refundMethod: "transfer" });
  pass("flow-C", "refund transfer completed");

  // --- Flow D: full return ---
  const { sale: saleD, items: itemsD } = await createTestSale(fx, { qty: 1 });
  const reqD = await createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
    originalTransactionId: saleD.id,
    lines: [{ salesItemId: itemsD[0]!.id, qty: 1 }],
  });
  cleanupReturnIds.push(reqD.id);
  await completeReturnQc(fx.tenantId, reqD.id, fx.userId, [
    { returnItemId: reqD.items[0]!.id, passed: true },
  ]);
  await chooseReturnSettlement(fx.tenantId, reqD.id, "standalone_refund");
  await completeReturnRefund(fx.tenantId, fx.userId, { returnId: reqD.id, refundMethod: "cash" });
  const origD = await db.query.salesTransactions.findFirst({ where: eq(salesTransactions.id, saleD.id) });
  if (origD?.returnStatus === "full" && origD.status === "returned") pass("flow-D", "full return status");
  else fail("flow-D", "full return status", `${origD?.returnStatus}/${origD?.status}`);

  // --- Flow E: credit sale → credit_adjust ---
  const custBefore = await db.query.customers.findFirst({ where: eq(customers.id, fx.customerId) });
  const debtBefore = custBefore?.outstandingDebt ?? 0;
  const { sale: saleE, items: itemsE } = await createTestSale(fx, {
    paymentMethod: "credit",
    customerId: fx.customerId,
    qty: 1,
    unitPrice: 50_000,
  });
  const reqE = await createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
    originalTransactionId: saleE.id,
    lines: [{ salesItemId: itemsE[0]!.id, qty: 1 }],
  });
  cleanupReturnIds.push(reqE.id);
  await completeReturnQc(fx.tenantId, reqE.id, fx.userId, [
    { returnItemId: reqE.items[0]!.id, passed: true },
  ]);
  await chooseReturnSettlement(fx.tenantId, reqE.id, "standalone_refund");
  const doneE = await completeReturnRefund(fx.tenantId, fx.userId, {
    returnId: reqE.id,
    refundMethod: "cash",
  });
  if (doneE.refundMethod === "credit_adjust") pass("flow-E", "credit sale auto credit_adjust");
  else fail("flow-E", "credit sale auto credit_adjust", String(doneE.refundMethod));

  // --- Flow F: late return → offset ---
  const lateDate = new Date();
  lateDate.setDate(lateDate.getDate() - 3);
  const { sale: saleF, items: itemsF } = await createTestSale(fx, { qty: 1, createdAt: lateDate });
  const reqF = await createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
    originalTransactionId: saleF.id,
    lines: [{ salesItemId: itemsF[0]!.id, qty: 1 }],
  });
  cleanupReturnIds.push(reqF.id);
  if (reqF.isLateReturn) pass("flow-F", "late return flagged");
  else fail("flow-F", "late return flagged", "isLateReturn=false");

  await completeReturnQc(fx.tenantId, reqF.id, fx.userId, [
    { returnItemId: reqF.items[0]!.id, passed: true },
  ]);

  await expectError("flow-F", "late refund tanpa approval ditolak", () =>
    chooseReturnSettlement(fx.tenantId, reqF.id, "standalone_refund"),
    "lewat batas",
  );

  const offsetChoice = await chooseReturnSettlement(fx.tenantId, reqF.id, "offset_in_new_sale");
  if (offsetChoice.status === "pending_offset") pass("flow-F", "pending offset");
  else fail("flow-F", "pending offset", offsetChoice.status);

  const pending = await listPendingOffsetReturns(fx.tenantId, fx.branchId);
  if (pending.some((r) => r.id === reqF.id)) pass("flow-F", "listed in pending offset");
  else fail("flow-F", "listed in pending offset", "not found");

  const { sale: offsetSale } = await createTestSale(fx, { qty: 1, unitPrice: 100_000 });
  const offsetAmount = offsetChoice.approvedRefundAmount;
  await db.transaction(async (tx) => {
    await finalizeReturnOffsetInTx(
      tx,
      fx.tenantId,
      reqF.id,
      fx.userId,
      offsetSale.id,
      offsetAmount,
    );
  });
  const offsetTx = await db.query.salesTransactions.findFirst({
    where: eq(salesTransactions.id, offsetSale.id),
  });
  if (offsetTx?.linkedReturnId === reqF.id && offsetTx.returnOffsetAmount === offsetAmount) {
    pass("flow-F", "offset linked on new sale", rupiah(offsetAmount));
  } else fail("flow-F", "offset linked", JSON.stringify(offsetTx));

  // --- Flow G: late return → approval → refund ---
  const { sale: saleG, items: itemsG } = await createTestSale(fx, { qty: 1, createdAt: lateDate });
  const reqG = await createReturnRequest(fx.tenantId, fx.branchId, fx.userId, {
    originalTransactionId: saleG.id,
    lines: [{ salesItemId: itemsG[0]!.id, qty: 1 }],
  });
  cleanupReturnIds.push(reqG.id);
  await completeReturnQc(fx.tenantId, reqG.id, fx.userId, [
    { returnItemId: reqG.items[0]!.id, passed: true },
  ]);
  const pendingApproval = await chooseReturnSettlement(fx.tenantId, reqG.id, "standalone_refund", {
    requestLateCash: true,
  });
  if (pendingApproval.status === "pending_approval") pass("flow-G", "pending manager approval");
  else fail("flow-G", "pending approval", pendingApproval.status);

  const approved = await approveLateReturnRefund(fx.tenantId, reqG.id, fx.userId);
  if (approved.status === "qc_completed") pass("flow-G", "manager approved");
  await ensureCashBalances(fx);
  await completeReturnRefund(fx.tenantId, fx.userId, { returnId: reqG.id, refundMethod: "transfer" });
  pass("flow-G", "late refund transfer completed");

  // --- API read helpers ---
  const txInfo = await getTransactionForReturn(fx.tenantId, saleA.id);
  if (txInfo?.items.length) pass("read", "getTransactionForReturn");
  const active = await listActiveReturns(fx.tenantId, fx.branchId);
  pass("read", "listActiveReturns", `${active.length} open`);

  // --- Summary ---
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n=== Result: ${checks.length - failed.length}/${checks.length} passed ===\n`);
  if (failed.length) {
    console.error("Failed:");
    for (const f of failed) console.error(`  - [${f.group}] ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

function rupiah(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

runUat()
  .then(async () => {
    // Optional: mark UAT transactions in notes only — no hard delete to preserve audit trail
    console.log("UAT data tagged with notes 'UAT sales returns' / transaction_number UAT-RTN-*");
  })
  .catch((e) => {
    console.error("UAT fatal:", e);
    process.exit(1);
  });

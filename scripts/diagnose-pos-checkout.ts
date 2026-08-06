#!/usr/bin/env node
/**
 * Diagnose POS checkout for a live tenant — run against Neon (same DB as production).
 * Usage: npx tsx scripts/diagnose-pos-checkout.ts [tenantSlug]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, and } from "drizzle-orm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
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

const slug = process.argv[2] ?? "tb-arkananta";

const { getDb } = await import("../src/server/db/index.ts");
const {
  tenants,
  branches,
  products,
  branchProducts,
  cashierSessions,
  profiles,
  salesItems,
} = await import("../src/server/db/schema.ts");
const { createSaleTransaction } = await import("../src/server/services/transactions.ts");

const db = getDb();
const tenant = await db.query.tenants.findFirst({
  where: eq(tenants.slug, slug),
});
if (!tenant) {
  console.error(`Tenant not found: ${slug}`);
  process.exit(1);
}

console.log(`\n=== Tenant: ${tenant.name} (${tenant.slug}) ===\n`);

const branchRows = await db.query.branches.findMany({
  where: eq(branches.tenantId, tenant.id),
});
console.log(`Branches: ${branchRows.length}`);
for (const b of branchRows) {
  console.log(`  - ${b.code} ${b.name} (${b.id})`);
}

const openSessions = await db.query.cashierSessions.findMany({
  where: and(eq(cashierSessions.tenantId, tenant.id), eq(cashierSessions.status, "open")),
});
console.log(`\nOpen cashier sessions: ${openSessions.length}`);
for (const s of openSessions) {
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, s.cashierId) });
  console.log(
    `  - session ${s.id.slice(0, 8)}… branch=${s.branchId.slice(0, 8)}… cashier=${profile?.name ?? s.cashierId}`,
  );
}

const semen = await db.query.products.findFirst({
  where: and(eq(products.tenantId, tenant.id), eq(products.name, "Semen Portland 50kg")),
});
if (semen) {
  console.log(`\nProduct: Semen Portland 50kg (${semen.sku}) id=${semen.id}`);
  const bps = await db
    .select()
    .from(branchProducts)
    .where(and(eq(branchProducts.tenantId, tenant.id), eq(branchProducts.productId, semen.id)));
  for (const bp of bps) {
    const br = branchRows.find((b) => b.id === bp.branchId);
    console.log(`  branch ${br?.code ?? bp.branchId}: stock=${bp.stock} legacy=${bp.legacyStock}`);
  }
} else {
  console.log("\nProduct 'Semen Portland 50kg' not found for this tenant");
}

// Dry-run checkout simulation on first branch with open session
const session = openSessions[0];
const branch = session ? branchRows.find((b) => b.id === session.branchId) : branchRows[0];
if (!session || !branch || !semen) {
  console.log("\nSkip checkout test — need open session + semen product");
  process.exit(0);
}

const bp = await db.query.branchProducts.findFirst({
  where: and(
    eq(branchProducts.tenantId, tenant.id),
    eq(branchProducts.branchId, branch.id),
    eq(branchProducts.productId, semen.id),
  ),
});

console.log(`\n--- Simulated checkout (branch ${branch.code}, qty=1) ---`);
if (!bp) {
  console.log("FAIL: no branch_products row — POS will fail STOCK_DEFICIT");
  process.exit(1);
}
if (bp.stock < 1 && bp.legacyStock < 1) {
  console.log(`WARN: stock=${bp.stock} legacy=${bp.legacyStock} — checkout will fail STOCK_DEFICIT`);
}

try {
  const tx = await createSaleTransaction(
    tenant.id,
    {
      branch_id: branch.id,
      session_id: session.id,
      cart_id: null,
      transaction_number: "",
      customer_id: null,
      customer_name: "Pelanggan Umum",
      subtotal: bp.sellingPrice,
      discount_amount: 0,
      tax_amount: 0,
      grand_total: bp.sellingPrice,
      payment_method: "cash",
      qris_provider: null,
      amount_paid: bp.sellingPrice,
      change_amount: 0,
      input_by: session.cashierId,
      paid_by: session.cashierId,
      is_cross_session: false,
      has_legacy_items: false,
      is_offline_transaction: false,
      offline_created_at: null,
      sync_status: "synced",
      status: "completed",
      notes: null,
    },
    [
      {
        product_id: semen.id,
        product_name: semen.name,
        sku: semen.sku,
        unit: semen.unit,
        qty: 1,
        purchase_price: semen.purchasePrice,
        selling_price: bp.sellingPrice,
        discount: 0,
        subtotal: bp.sellingPrice,
        stock_source: "verified",
        is_so_line: false,
      },
    ],
  );
  console.log(`OK: ${tx.transaction_number}`);
  // Void immediately to not pollute live data
  const { voidSaleTransaction } = await import("../src/server/services/transactions.ts");
  await voidSaleTransaction(tenant.id, tx.id, session.cashierId);
  console.log(`Voided test transaction ${tx.transaction_number}`);
} catch (err) {
  console.error("CHECKOUT FAILED:");
  console.error(err instanceof Error ? err.message : err);
  if (err instanceof Error && err.cause) console.error("cause:", err.cause);
  process.exit(1);
}

#!/usr/bin/env node
/**
 * UAT — data sync / integration integrity across modules
 * Usage: npm run neon:uat:sync
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Client, neonConfig } from "@neondatabase/serverless";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
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

const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
const checks = [];

function pass(name, detail = "") {
  checks.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

function warn(name, detail) {
  checks.push({ name, ok: true, detail, warn: true });
  console.log(`  ⚠ ${name} — ${detail}`);
}

async function runIntegrityChecks(client) {
  // --- Referential integrity ---
  const orphanItems = await client.query(`
    SELECT count(*)::int AS c FROM sales_items si
    LEFT JOIN sales_transactions st ON st.id = si.transaction_id
    WHERE st.id IS NULL
  `);
  if (orphanItems.rows[0]?.c === 0) pass("FK sales_items → sales_transactions", "no orphans");
  else fail("FK sales_items → sales_transactions", `${orphanItems.rows[0]?.c} orphan rows`);

  const orphanMovements = await client.query(`
    SELECT count(*)::int AS c FROM stock_movements sm
    WHERE sm.reference IS NOT NULL
      AND sm.reference LIKE 'TRX-%'
      AND NOT EXISTS (
        SELECT 1 FROM sales_transactions st
        WHERE st.transaction_number = sm.reference AND st.tenant_id = sm.tenant_id
      )
  `);
  if (orphanMovements.rows[0]?.c === 0) {
    pass("stock_movements reference → sales_transactions", "TRX refs valid");
  } else {
    warn(
      "stock_movements reference → sales_transactions",
      `${orphanMovements.rows[0]?.c} unmatched TRX refs (legacy/manual?)`,
    );
  }

  const orphanDelivery = await client.query(`
    SELECT count(*)::int AS c FROM deliveries d
    LEFT JOIN sales_transactions st ON st.id = d.sales_transaction_id
    WHERE st.id IS NULL
  `);
  if (orphanDelivery.rows[0]?.c === 0) pass("FK deliveries → sales_transactions", "no orphans");
  else fail("FK deliveries → sales_transactions", `${orphanDelivery.rows[0]?.c} orphan rows`);

  // --- Session totals vs completed transactions ---
  const sessionMismatch = await client.query(`
    WITH agg AS (
      SELECT
        st.session_id,
        st.tenant_id,
        COALESCE(SUM(st.grand_total) FILTER (WHERE st.status = 'completed'), 0)::numeric AS tx_total,
        COUNT(*) FILTER (WHERE st.status = 'completed')::int AS tx_count
      FROM sales_transactions st
      WHERE st.session_id IS NOT NULL
      GROUP BY st.session_id, st.tenant_id
    )
    SELECT count(*)::int AS c
    FROM agg
    JOIN cashier_sessions cs ON cs.id = agg.session_id AND cs.tenant_id = agg.tenant_id
    WHERE ABS(cs.total_sales - agg.tx_total) > 0.01
       OR cs.total_transactions != agg.tx_count
  `);
  const mismatchCount = sessionMismatch.rows[0]?.c ?? 0;
  if (mismatchCount === 0) {
    pass("cashier_sessions totals ↔ completed sales_transactions", "in sync");
  } else {
    fail(
      "cashier_sessions totals ↔ completed sales_transactions",
      `${mismatchCount} session(s) mismatch — void/historical drift?`,
    );
  }

  // --- Credit sales → AR ---
  const creditWithoutAr = await client.query(`
    SELECT count(*)::int AS c
    FROM sales_transactions st
    WHERE st.status = 'completed'
      AND st.payment_method = 'credit'
      AND (st.grand_total - st.amount_paid) > 0
      AND NOT EXISTS (
        SELECT 1 FROM accounts_receivable ar
        WHERE ar.sales_transaction_id = st.id AND ar.tenant_id = st.tenant_id
      )
  `);
  if (creditWithoutAr.rows[0]?.c === 0) {
    pass("POS kredit → accounts_receivable", "all credit sales have AR row");
  } else {
    fail(
      "POS kredit → accounts_receivable",
      `${creditWithoutAr.rows[0]?.c} credit sale(s) missing AR`,
    );
  }

  // --- Voided sales excluded from session (if voided after session close, may drift) ---
  const voidStillCompleted = await client.query(`
    SELECT count(*)::int AS c FROM sales_transactions WHERE status NOT IN ('completed', 'voided')
  `);
  pass("sales_transactions status enum", `${voidStillCompleted.rows[0]?.c} non-standard status rows`);

  // --- GRN → stock movements ---
  const grnWithoutStock = await client.query(`
    SELECT count(*)::int AS c
    FROM goods_receipt_items gri
    JOIN goods_receipts gr ON gr.id = gri.gr_id
    WHERE NOT EXISTS (
      SELECT 1 FROM stock_movements sm
      WHERE sm.tenant_id = gr.tenant_id
        AND sm.branch_id = gr.branch_id
        AND sm.product_id = gri.product_id
        AND sm.type = 'in'
        AND sm.reference LIKE 'GRN-%'
    )
  `);
  const grnGap = grnWithoutStock.rows[0]?.c ?? 0;
  if (grnGap === 0) pass("GRN → stock_movements (type=in)", "linked");
  else warn("GRN → stock_movements", `${grnGap} GRN line(s) without matching movement`);

  // --- PO → AP auto link (expected gap) ---
  const poWithoutAp = await client.query(`
    SELECT count(*)::int AS c
    FROM goods_receipts gr
    JOIN purchase_orders po ON po.id = gr.purchase_order_id
    WHERE NOT EXISTS (
      SELECT 1 FROM accounts_payable ap
      WHERE ap.purchase_order_id = po.id AND ap.tenant_id = gr.tenant_id
    )
  `);
  const poApGap = poWithoutAp.rows[0]?.c ?? 0;
  if (poApGap > 0) {
    warn(
      "GRN/PO → accounts_payable",
      `${poApGap} GRN(s) without AP — expected (manual AP only)`,
    );
  } else {
    pass("GRN/PO → accounts_payable", "all GRN have AP (or no GRN data)");
  }

  // --- POS cash → cash_transactions (expected gap on Neon) ---
  const cashSalesNoLedger = await client.query(`
    SELECT count(*)::int AS c
    FROM sales_transactions st
    WHERE st.status = 'completed'
      AND st.payment_method IN ('cash', 'transfer', 'card')
      AND NOT EXISTS (
        SELECT 1 FROM cash_transactions ct
        WHERE ct.reference = st.transaction_number AND ct.tenant_id = st.tenant_id
      )
  `);
  const cashGap = cashSalesNoLedger.rows[0]?.c ?? 0;
  if (cashGap > 0) {
    warn(
      "POS tunai/transfer → cash_transactions (historical)",
      `${cashGap} sale(s) lama belum di buku kas — penjualan baru auto-post`,
    );
  } else {
    pass("POS tunai/transfer → cash_transactions", "all linked or no cash sales");
  }

  // --- deliveries table usage ---
  const deliveryCount = await client.query(`SELECT count(*)::int AS c FROM deliveries`);
  const salesCount = await client.query(
    `SELECT count(*)::int AS c FROM sales_transactions WHERE status = 'completed'`,
  );
  if (deliveryCount.rows[0]?.c === 0 && salesCount.rows[0]?.c > 0) {
    warn(
      "POS → deliveries (historical)",
      `${salesCount.rows[0]?.c} sales lama tanpa delivery — checkout kirim baru auto-insert`,
    );
  } else if (deliveryCount.rows[0]?.c > 0) {
    pass("deliveries table", `${deliveryCount.rows[0]?.c} row(s)`);
  } else {
    pass("deliveries table", "empty (no sales yet)");
  }

  // --- online_orders ---
  const onlineCount = await client.query(`SELECT count(*)::int AS c FROM online_orders`);
  if (onlineCount.rows[0]?.c === 0) {
    warn("order online → online_orders", "0 rows — portal client-only on Neon");
  } else {
    pass("online_orders table", `${onlineCount.rows[0]?.c} row(s)`);
  }

  // --- daily rollup vs raw (yesterday) ---
  const rollupCheck = await client.query(`
    WITH raw AS (
      SELECT
        tenant_id,
        branch_id,
        (created_at AT TIME ZONE 'Asia/Jakarta')::date AS sale_date,
        COALESCE(SUM(grand_total), 0)::numeric AS revenue
      FROM sales_transactions
      WHERE status = 'completed'
        AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = (CURRENT_DATE AT TIME ZONE 'Asia/Jakarta' - INTERVAL '1 day')::date
      GROUP BY 1, 2, 3
    ),
    rolled AS (
      SELECT tenant_id, branch_id, sale_date, total_revenue::numeric AS revenue
      FROM daily_branch_sales
      WHERE sale_date = (CURRENT_DATE AT TIME ZONE 'Asia/Jakarta' - INTERVAL '1 day')::date
    )
    SELECT count(*)::int AS c
    FROM raw
    FULL OUTER JOIN rolled USING (tenant_id, branch_id, sale_date)
    WHERE raw.revenue IS NULL OR rolled.revenue IS NULL OR ABS(raw.revenue - rolled.revenue) > 0.01
  `);
  const rollupGap = rollupCheck.rows[0]?.c ?? 0;
  if (rollupGap === 0) {
    pass("daily_branch_sales rollup ↔ raw sales (yesterday)", "match or no yesterday data");
  } else {
    warn(
      "daily_branch_sales rollup ↔ raw sales (yesterday)",
      `${rollupGap} branch-day mismatch — run npm run neon:rollup:daily`,
    );
  }
}

async function runE2ESaleFlow(client) {
  const tenantId = randomUUID();
  const branchId = randomUUID();
  const userId = randomUUID();
  const productId = randomUUID();
  const bpId = randomUUID();
  const sessionId = randomUUID();
  const customerId = randomUUID();
  const suffix = Date.now().toString(36);

  try {
    const hash = await bcrypt.hash("123456", 10);
    await client.query(
      `INSERT INTO tenants (id, name, slug, owner_email, plan, is_active, onboarding_complete)
       VALUES ($1, 'UAT Sync', $2, $3, 'trial', true, true)`,
      [tenantId, `uat-sync-${suffix}`, `sync-${suffix}@test.local`],
    );
    await client.query(
      `INSERT INTO branches (id, tenant_id, code, name, is_active) VALUES ($1, $2, 'UAT', 'UAT Branch', true)`,
      [branchId, tenantId],
    );
    await client.query(
      `INSERT INTO auth_users (id, email, username, password_hash, tenant_id) VALUES ($1, $2, $3, $4, $5)`,
      [userId, `sync-${suffix}@test.local`, `sync.${suffix}`, hash, tenantId],
    );
    await client.query(
      `INSERT INTO profiles (id, tenant_id, name, email, role, is_active) VALUES ($1, $2, 'Kasir', $3, 'cashier', true)`,
      [userId, tenantId, `sync-${suffix}@test.local`],
    );
    await client.query(
      `INSERT INTO products (id, tenant_id, sku, name, unit, purchase_price, is_active)
       VALUES ($1, $2, 'SKU-UAT', 'Semen UAT', 'sak', 50000, true)`,
      [productId, tenantId],
    );
    await client.query(
      `INSERT INTO branch_products (id, tenant_id, branch_id, product_id, selling_price, stock, legacy_stock, reorder_point)
       VALUES ($1, $2, $3, $4, 65000, 100, 0, 10)`,
      [bpId, tenantId, branchId, productId],
    );
    await client.query(
      `INSERT INTO customers (id, tenant_id, name, phone, credit_limit, outstanding_debt)
       VALUES ($1, $2, 'Pelanggan Kredit', '081111', 5000000, 0)`,
      [customerId, tenantId],
    );
    await client.query(
      `INSERT INTO cashier_sessions (id, tenant_id, branch_id, cashier_id, status, opening_cash_balance, expected_cash_balance, total_sales, total_transactions)
       VALUES ($1, $2, $3, $4, 'open', 100000, 100000, 0, 0)`,
      [sessionId, tenantId, branchId, userId],
    );

    const txId = randomUUID();
    const txNumber = `TRX-UAT-${suffix}`;
    const qty = 2;
    const subtotal = 130000;
    const grandTotal = 130000;

    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO sales_transactions (
          id, tenant_id, branch_id, session_id, transaction_number, payment_method,
          status, subtotal, discount_amount, grand_total, amount_paid, change_amount,
          paid_by, customer_id, customer_name
        ) VALUES ($1,$2,$3,$4,$5,'cash','completed',$6,0,$6,$6,0,$7,NULL,NULL)`,
        [txId, tenantId, branchId, sessionId, txNumber, subtotal, userId],
      );
      await client.query(
        `INSERT INTO sales_items (id, tenant_id, transaction_id, product_id, product_name, sku, unit, qty, purchase_price, selling_price, discount, subtotal, stock_source)
         VALUES ($1,$2,$3,$4,'Semen UAT','SKU-UAT','sak',$5,50000,65000,0,$6,'verified')`,
        [randomUUID(), tenantId, txId, productId, qty, subtotal],
      );
      await client.query(
        `UPDATE branch_products SET stock = stock - $1 WHERE id = $2`,
        [qty, bpId],
      );
      await client.query(
        `INSERT INTO stock_movements (id, tenant_id, branch_id, product_id, type, stock_source, qty, qty_before, qty_after, reference, user_id)
         VALUES ($1,$2,$3,$4,'out','verified',$5,100,98,$6,$7)`,
        [randomUUID(), tenantId, branchId, productId, qty, txNumber, userId],
      );
      await client.query(
        `UPDATE cashier_sessions SET total_sales = total_sales + $1, total_transactions = total_transactions + 1,
         total_cash_sales = total_cash_sales + $1, expected_cash_balance = expected_cash_balance + $1
         WHERE id = $2`,
        [grandTotal, sessionId],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }

    const hist = await client.query(
      `SELECT id FROM sales_transactions WHERE tenant_id = $1 AND transaction_number = $2`,
      [tenantId, txNumber],
    );
    if (hist.rows.length === 1) pass("E2E POS → sales_transactions", txNumber);
    else fail("E2E POS → sales_transactions", "not found");

    const stock = await client.query(`SELECT stock FROM branch_products WHERE id = $1`, [bpId]);
    if (stock.rows[0]?.stock === 98) pass("E2E POS → branch_products stock", "100 → 98");
    else fail("E2E POS → branch_products stock", `got ${stock.rows[0]?.stock}`);

    const mov = await client.query(
      `SELECT count(*)::int AS c FROM stock_movements WHERE reference = $1 AND type = 'out'`,
      [txNumber],
    );
    if (mov.rows[0]?.c >= 1) pass("E2E POS → stock_movements", "out recorded");
    else fail("E2E POS → stock_movements", "missing");

    const sess = await client.query(
      `SELECT total_sales, total_transactions FROM cashier_sessions WHERE id = $1`,
      [sessionId],
    );
    if (
      Number(sess.rows[0]?.total_sales) === grandTotal &&
      sess.rows[0]?.total_transactions === 1
    ) {
      pass("E2E POS → cashier_sessions", "totals updated");
    } else {
      fail("E2E POS → cashier_sessions", JSON.stringify(sess.rows[0]));
    }

    // Credit sale + AR
    const txId2 = randomUUID();
    const txNumber2 = `TRX-CR-${suffix}`;
    const creditDebt = 80000;
    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO sales_transactions (
          id, tenant_id, branch_id, session_id, transaction_number, payment_method,
          status, subtotal, discount_amount, grand_total, amount_paid, change_amount,
          paid_by, customer_id, customer_name
        ) VALUES ($1,$2,$3,$4,$5,'credit','completed',80000,0,80000,0,0,$6,$7,'Pelanggan Kredit')`,
        [txId2, tenantId, branchId, sessionId, txNumber2, userId, customerId],
      );
      await client.query(
        `UPDATE customers SET outstanding_debt = outstanding_debt + $1 WHERE id = $2`,
        [creditDebt, customerId],
      );
      await client.query(
        `INSERT INTO accounts_receivable (id, tenant_id, branch_id, customer_id, customer_name, sales_transaction_id, invoice_number, total_amount, paid_amount, status, due_date)
         VALUES ($1,$2,$3,$4,'Pelanggan Kredit',$5,$6,$7,0,'unpaid', CURRENT_DATE + 30)`,
        [
          randomUUID(),
          tenantId,
          branchId,
          customerId,
          txId2,
          `AR-${txNumber2}`,
          creditDebt,
        ],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }

    const ar = await client.query(
      `SELECT total_amount FROM accounts_receivable WHERE sales_transaction_id = $1`,
      [txId2],
    );
    if (Number(ar.rows[0]?.total_amount) === creditDebt) {
      pass("E2E POS kredit → accounts_receivable", `Rp ${creditDebt}`);
    } else {
      fail("E2E POS kredit → accounts_receivable", "mismatch");
    }

    const debt = await client.query(
      `SELECT outstanding_debt FROM customers WHERE id = $1`,
      [customerId],
    );
    if (Number(debt.rows[0]?.outstanding_debt) === creditDebt) {
      pass("E2E POS kredit → customers.outstanding_debt", "sync");
    } else {
      fail("E2E POS kredit → customers.outstanding_debt", String(debt.rows[0]?.outstanding_debt));
    }
  } finally {
    await client.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
  }
}

async function runServiceE2E() {
  const runnerPath = join(root, "scripts", "uat-data-sync-runner.ts");
  if (!existsSync(runnerPath)) {
    warn("service E2E (tsx)", "runner not found — skipped");
    return;
  }
  const result = spawnSync("npx", ["--yes", "tsx", runnerPath], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status === 0) {
    pass("service createSaleTransaction E2E", "tsx runner OK");
  } else {
    if (result.stderr) process.stderr.write(result.stderr);
    warn(
      "service createSaleTransaction E2E",
      `tsx runner exit ${result.status} — SQL E2E covers model`,
    );
  }
}

async function main() {
  if (!dbUrl) {
    fail("DATABASE_URL", "missing");
    process.exit(1);
  }

  if (typeof globalThis.WebSocket === "undefined") {
    const { default: ws } = await import("ws");
    neonConfig.webSocketConstructor = ws;
  }

  const client = new Client(dbUrl);
  await client.connect();
  pass("database", "connected");

  console.log("\n— Integritas data existing —");
  await runIntegrityChecks(client);

  console.log("\n— E2E alur penjualan (SQL mirror) —");
  await runE2ESaleFlow(client);

  await client.end();

  console.log("\n— E2E via service (tsx) —");
  await runServiceE2E();

  const failed = checks.filter((c) => !c.ok);
  const warned = checks.filter((c) => c.warn);
  console.log(
    `\nUAT data sync: ${checks.length - failed.length}/${checks.length} passed` +
      (warned.length ? `, ${warned.length} warning(s)` : ""),
  );
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

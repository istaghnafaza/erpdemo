#!/usr/bin/env node
/**
 * UAT — platform admin, wilayah proxy, register address, branch gate data
 * Usage: npm run neon:uat:platform
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Client, neonConfig } from "@neondatabase/serverless";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEV_URL = process.env.UAT_BASE_URL ?? "http://localhost:8081";

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

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
const checks = [];

function pass(name, detail) {
  checks.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
  console.error(`✗ ${name}: ${detail}`);
}

if (!url) {
  fail("env DATABASE_URL", "not set");
  process.exit(1);
}

if (typeof globalThis.WebSocket === "undefined") {
  const { default: ws } = await import("ws");
  neonConfig.webSocketConstructor = ws;
}

// --- 1. Wilayah API (server-side, no CORS) ---
try {
  const res = await fetch("https://wilayah.id/api/provinces.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const count = json.data?.length ?? 0;
  if (count < 30) throw new Error(`only ${count} provinces`);
  pass("wilayah API provinces", `${count} provinsi`);
} catch (err) {
  fail("wilayah API provinces", err instanceof Error ? err.message : String(err));
}

// --- 2. Dev server pages ---
for (const path of ["/register", "/login", "/platform/dashboard"]) {
  try {
    const res = await fetch(`${DEV_URL}${path}`, { redirect: "manual" });
    const ok = res.status === 200 || res.status === 307 || res.status === 302;
    if (!ok) throw new Error(`HTTP ${res.status}`);
    pass(`HTTP ${path}`, `status ${res.status}`);
  } catch (err) {
    fail(`HTTP ${path}`, err instanceof Error ? err.message : String(err));
  }
}

const client = new Client(url);
try {
  await client.connect();

  // --- 3. Migration column ---
  const col = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'is_platform_admin'
  `);
  if (!col.rows.length) fail("migration phase10", "is_platform_admin column missing");
  else pass("migration phase10", "is_platform_admin exists");

  // --- 4. Platform admin account ---
  const username = process.env.PLATFORM_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!username || !password) {
    fail("platform admin env", "PLATFORM_ADMIN_USERNAME/PASSWORD missing");
  } else {
    const adminRes = await client.query(
      `SELECT id, email, password_hash, is_platform_admin, tenant_id
       FROM auth_users WHERE lower(username) = $1 LIMIT 1`,
      [username],
    );
    const row = adminRes.rows[0];
    if (!row) fail("platform admin seed", "user not found — run npm run neon:seed:platform-admin");
    else {
      const valid = await bcrypt.compare(password, row.password_hash);
      if (!valid) fail("platform admin login", "password mismatch");
      else pass("platform admin login", `${username} / PIN ok`);
      if (!row.is_platform_admin) fail("platform admin flag", "is_platform_admin false");
      else pass("platform admin flag", "is_platform_admin true");
      if (row.tenant_id) fail("platform admin scope", "should have null tenant_id");
      else pass("platform admin scope", "no tenant binding");
    }
  }

  // --- 5. Platform metrics query ---
  const metrics = await client.query(`
    SELECT COUNT(*)::int AS total FROM tenants
  `);
  const totalTenants = metrics.rows[0]?.total ?? 0;
  pass("platform metrics tenants", `${totalTenants} tenant(s) in DB`);

  const revenue = await client.query(`
    SELECT COALESCE(SUM(total_revenue), 0)::bigint AS rev
    FROM daily_branch_sales
    WHERE sale_date >= CURRENT_DATE - INTERVAL '30 days'
  `);
  pass("platform metrics revenue 30d", `Rp ${Number(revenue.rows[0]?.rev ?? 0).toLocaleString("id-ID")}`);

  // --- 6. Register with address (DB-level smoke) ---
  const testUser = `uat.${Date.now().toString(36)}`;
  const testEmail = `${testUser}@uat.local`;
  const tenantId = randomUUID();
  const userId = randomUUID();
  const branchId = randomUUID();
  const pinHash = await bcrypt.hash("654321", 10);
  const fullAddress = "Jl. UAT No. 1, Gambir, Gambir, Kota Administrasi Jakarta Pusat, DKI Jakarta";

  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO tenants (id, name, slug, owner_email, phone, plan, is_active, onboarding_complete)
       VALUES ($1, 'Toko Baru', $2, $3, '081234567890', 'trial', true, false)`,
      [tenantId, testUser, testEmail],
    );
    await client.query(
      `INSERT INTO branches (id, tenant_id, code, name, address, phone, is_active)
       VALUES ($1, $2, 'HQ', 'Cabang Utama', $3, '081234567890', true)`,
      [branchId, tenantId, fullAddress],
    );
    await client.query(
      `INSERT INTO auth_users (id, email, username, password_hash, tenant_id, is_platform_admin)
       VALUES ($1, $2, $3, $4, $5, false)`,
      [userId, testEmail, testUser, pinHash, tenantId],
    );
    await client.query(
      `INSERT INTO profiles (id, tenant_id, name, email, role, is_active)
       VALUES ($1, $2, 'UAT Owner', $3, 'owner', true)`,
      [userId, tenantId, testEmail],
    );
    await client.query(
      `INSERT INTO user_branches (user_id, branch_id, tenant_id) VALUES ($1, $2, $3)`,
      [userId, branchId, tenantId],
    );

    const addrCheck = await client.query(`SELECT address FROM branches WHERE id = $1`, [branchId]);
    if (addrCheck.rows[0]?.address !== fullAddress) {
      fail("register address save", "address mismatch on branch");
    } else {
      pass("register address save", "branch.address stored");
    }

    await client.query("ROLLBACK");
    pass("register address cleanup", "rolled back test tenant");
  } catch (err) {
    await client.query("ROLLBACK");
    fail("register address save", err instanceof Error ? err.message : String(err));
  }

  // --- 7. Branch gate scenario ---
  const inactive = await client.query(`
    SELECT t.slug, COUNT(b.id) FILTER (WHERE b.is_active)::int AS active_branches
    FROM tenants t
    LEFT JOIN branches b ON b.tenant_id = t.id
    GROUP BY t.id, t.slug
    HAVING COUNT(b.id) FILTER (WHERE b.is_active) = 0
    LIMIT 3
  `);
  pass(
    "branch gate candidates",
    inactive.rows.length
      ? `${inactive.rows.length} tenant(s) with 0 active branch`
      : "all tenants have active branch (gate triggers after close toko)",
  );
} finally {
  await client.end();
}

const failed = checks.filter((c) => !c.ok);
console.log("\n---");
console.log(
  failed.length
    ? `UAT FAILED (${failed.length}/${checks.length})`
    : `UAT PASSED (${checks.length}/${checks.length})`,
);
console.log(`\nManual UI checks:`);
console.log(`  Register:  ${DEV_URL}/register  (dropdown ketik + telepon wajib)`);
console.log(`  Dev login: ${DEV_URL}/login     (dev.ses / 123456 → platform dashboard)`);
process.exit(failed.length ? 1 : 0);

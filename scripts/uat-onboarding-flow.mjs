#!/usr/bin/env node
/**
 * UAT — register → onboarding branch → add branch → optional staff
 * Usage: node scripts/uat-onboarding-flow.mjs
 */
import { readFileSync, existsSync } from "node:fs";
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
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(join(root, ".env"));

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
const checks = [];
const cleanup = { tenantId: null, username: null };

function pass(name, detail) {
  checks.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
  console.error(`✗ ${name}: ${detail}`);
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "toko"
  );
}

function deriveBranchCode(name) {
  const letters = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "CBG").padEnd(3, "X").slice(0, 3);
}

function ensureUniqueBranchCode(preferred, existingCodes) {
  const taken = new Set(existingCodes.map((c) => c.toUpperCase()));
  const base = preferred.toUpperCase() || "CBG";
  if (!taken.has(base)) return base;
  const stem = base.length >= 2 ? base.slice(0, 2) : `${base}X`.slice(0, 2);
  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("branch code exhausted");
}

if (!url) {
  fail("env", "DATABASE_URL not set");
  process.exit(1);
}

if (typeof globalThis.WebSocket === "undefined") {
  const { default: ws } = await import("ws");
  neonConfig.webSocketConstructor = ws;
}

const client = new Client(url);
const runId = Date.now().toString(36);
const username = `uat${runId}`.slice(0, 20);
const pin = "654321";
cleanup.username = username;

try {
  await client.connect();
  pass("db", "connected");

  // --- 1. Register (mirror register.ts) ---
  const tenantId = randomUUID();
  const userId = randomUUID();
  const branchId = randomUUID();
  const email = `${username}@noemail.local`;
  const businessName = `UAT Toko ${runId}`;
  const slug = `${slugify(businessName)}-${runId.slice(-4)}`;
  const passwordHash = await bcrypt.hash(pin, 10);
  cleanup.tenantId = tenantId;

  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO tenants (id, name, slug, owner_email, phone, plan, trial_ends_at, is_active, onboarding_complete, legacy_mode_active)
       VALUES ($1, $2, $3, $4, NULL, 'trial', NOW() + INTERVAL '14 days', TRUE, FALSE, FALSE)`,
      [tenantId, businessName, slug, email],
    );

    await client.query(
      `INSERT INTO branches (id, tenant_id, code, name, address, phone, is_active)
       VALUES ($1, $2, 'HQ', 'Cabang Utama', NULL, NULL, TRUE)`,
      [branchId, tenantId],
    );

    await client.query(
      `INSERT INTO auth_users (id, email, username, password_hash, tenant_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, email, username, passwordHash, tenantId],
    );

    await client.query(
      `INSERT INTO profiles (id, tenant_id, name, email, role, pin, is_active)
       VALUES ($1, $2, 'Owner UAT', $3, 'owner', NULL, TRUE)`,
      [userId, tenantId, email],
    );

    await client.query(
      `INSERT INTO user_branches (user_id, branch_id, tenant_id) VALUES ($1, $2, $3)`,
      [userId, branchId, tenantId],
    );

    await client.query("COMMIT");
    pass("register", `tenant=${tenantId.slice(0, 8)}… user=${username}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }

  // --- 2. Login lookup (mirror auth.ts — username case-sensitive exact) ---
  const loginRes = await client.query(
    `SELECT id FROM auth_users WHERE username = $1 LIMIT 1`,
    [username],
  );
  if (loginRes.rows[0]?.id !== userId) {
    fail("login-lookup", "username lookup failed");
  } else {
    pass("login-lookup", username);
  }

  const loginWrongCase = await client.query(
    `SELECT id FROM auth_users WHERE username = $1 LIMIT 1`,
    [username.toUpperCase()],
  );
  if (loginWrongCase.rows.length > 0 && username !== username.toUpperCase()) {
    fail("login-case", "username must be case-sensitive");
  } else {
    pass("login-case", "wrong case rejected");
  }

  const hashRes = await client.query(`SELECT password_hash FROM auth_users WHERE id = $1`, [userId]);
  const validPin = await bcrypt.compare(pin, hashRes.rows[0].password_hash);
  if (!validPin) fail("login-pin", "PIN mismatch");
  else pass("login-pin", "654321");

  // --- 3. Finalize onboarding primary branch (mirror branches.ts) ---
  const branchRows = await client.query(
    `SELECT id, code, name FROM branches WHERE tenant_id = $1 ORDER BY name`,
    [tenantId],
  );
  const all = branchRows.rows;
  const storeName = businessName;
  const code = deriveBranchCode(storeName);
  const placeholder = all.find((b) => b.code === "HQ" && b.name === "Cabang Utama");

  if (!placeholder) {
    fail("onboarding-branch", "HQ placeholder missing");
  } else {
    await client.query(
      `UPDATE branches SET code = $1, name = $2, address = $3, phone = $4, is_active = TRUE
       WHERE id = $5 AND tenant_id = $6`,
      [code, storeName, "Jl UAT No 1", "08123456789", placeholder.id, tenantId],
    );
    pass("onboarding-branch", `updated HQ → ${code} / ${storeName}`);
  }

  await client.query(
    `UPDATE tenants SET onboarding_complete = TRUE, legacy_mode_active = FALSE WHERE id = $1`,
    [tenantId],
  );
  pass("onboarding-complete", "tenant flagged");

  // --- 4. Add second branch ---
  const branchesAfter = await client.query(
    `SELECT code FROM branches WHERE tenant_id = $1`,
    [tenantId],
  );
  const codes = branchesAfter.rows.map((r) => r.code);
  const newBranchName = "Cabang Bekasi UAT";
  const newCode = ensureUniqueBranchCode(deriveBranchCode(newBranchName), codes);
  const newBranchId = randomUUID();

  await client.query(
    `INSERT INTO branches (id, tenant_id, code, name, address, phone, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
    [newBranchId, tenantId, newCode, newBranchName, "Jl Bekasi Raya 88", "08111111111"],
  );

  await client.query(
    `INSERT INTO user_branches (user_id, branch_id, tenant_id) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [userId, newBranchId, tenantId],
  );

  const branchCount = await client.query(
    `SELECT count(*)::int AS c FROM branches WHERE tenant_id = $1 AND is_active = TRUE`,
    [tenantId],
  );
  if (branchCount.rows[0].c < 2) {
    fail("add-branch", `expected 2 branches, got ${branchCount.rows[0].c}`);
  } else {
    pass("add-branch", `${newCode} — total ${branchCount.rows[0].c} active`);
  }

  // --- 5. Create staff without email (onboarding edge case) ---
  const staffId = randomUUID();
  const staffPin = "112233";
  const staffHash = await bcrypt.hash(staffPin, 10);
  const staffSlug = "kasir.uat";
  const staffEmail = `${staffSlug}.${staffId.slice(0, 8)}@staff.local`;
  const staffUsername = `${staffSlug}${staffId.slice(0, 6)}`.slice(0, 32);

  await client.query(
    `INSERT INTO auth_users (id, email, username, password_hash, tenant_id) VALUES ($1, $2, $3, $4, $5)`,
    [staffId, staffEmail, staffUsername, staffHash, tenantId],
  );
  await client.query(
    `INSERT INTO profiles (id, tenant_id, name, email, role, pin, is_active)
     VALUES ($1, $2, 'Kasir UAT', $3, 'cashier', $4, TRUE)`,
    [staffId, tenantId, staffEmail, staffPin],
  );
  await client.query(
    `INSERT INTO user_branches (user_id, branch_id, tenant_id) VALUES ($1, $2, $3)`,
    [staffId, placeholder?.id ?? branchId, tenantId],
  );
  pass("staff-create-no-email", `${staffUsername} / ${staffEmail}`);

  // --- 6. Duplicate branch code collision ---
  try {
    await client.query(
      `INSERT INTO branches (id, tenant_id, code, name, is_active) VALUES ($1, $2, $3, $4, TRUE)`,
      [randomUUID(), tenantId, code, "Duplikat"],
    );
    fail("unique-branch-code", "should reject duplicate code");
  } catch {
    pass("unique-branch-code", `code ${code} protected`);
  }
} catch (err) {
  fail("exception", err instanceof Error ? err.message : String(err));
} finally {
  if (cleanup.tenantId) {
    try {
      await client.query(`DELETE FROM tenants WHERE id = $1`, [cleanup.tenantId]);
      pass("cleanup", cleanup.tenantId.slice(0, 8));
    } catch (e) {
      fail("cleanup", e instanceof Error ? e.message : String(e));
    }
  }
  await client.end();
}

const ok = checks.every((c) => c.ok);
console.log("\n" + JSON.stringify({ ok, checks }, null, 2));
process.exit(ok ? 0 : 1);

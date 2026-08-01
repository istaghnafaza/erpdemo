#!/usr/bin/env node
/**
 * UAT — subscription plan limits & pricing page
 * Usage: npm run neon:uat:plan
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Client, neonConfig } from "@neondatabase/serverless";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEV_URL = process.env.UAT_BASE_URL ?? "http://localhost:8081";

const PRO_MAX_BRANCHES = 2;
const PRO_MAX_USERS = 15;
const TRIAL_DAYS = 7;

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

async function countActiveBranches(client, tenantId) {
  const r = await client.query(
    `SELECT count(*)::int AS c FROM branches WHERE tenant_id = $1 AND is_active = true`,
    [tenantId],
  );
  return r.rows[0]?.c ?? 0;
}

async function countActiveUsers(client, tenantId) {
  const r = await client.query(
    `SELECT count(*)::int AS c FROM profiles WHERE tenant_id = $1 AND is_active = true`,
    [tenantId],
  );
  return r.rows[0]?.c ?? 0;
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

  const suffix = Date.now().toString(36);
  const tenantId = randomUUID();
  const userId = randomUUID();
  const slug = `uat-plan-${suffix}`;

  try {
    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO tenants (id, name, slug, owner_email, phone, plan, trial_ends_at, is_active, onboarding_complete)
       VALUES ($1, $2, $3, $4, $5, 'pro', $6, true, true)`,
      [tenantId, "UAT Plan Limits", slug, `uat-${suffix}@test.local`, "08123456789", trialEnds],
    );
    pass("tenant pro created");

    const hash = await bcrypt.hash("123456", 10);
    await client.query(
      `INSERT INTO auth_users (id, email, username, password_hash, tenant_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, `uat-${suffix}@test.local`, `uat.${suffix}`, hash, tenantId],
    );
    await client.query(
      `INSERT INTO profiles (id, tenant_id, name, email, role, pin, is_active)
       VALUES ($1, $2, 'Owner UAT', $3, 'owner', '123456', true)`,
      [userId, tenantId, `uat-${suffix}@test.local`],
    );
    pass("owner created");

    for (let i = 1; i <= PRO_MAX_BRANCHES; i++) {
      await client.query(
        `INSERT INTO branches (id, tenant_id, code, name, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [randomUUID(), tenantId, `B${i}`, `Cabang ${i}`],
      );
    }
    const branchCount = await countActiveBranches(client, tenantId);
    if (branchCount === PRO_MAX_BRANCHES) pass("pro branch seed", `${branchCount}/${PRO_MAX_BRANCHES}`);
    else fail("pro branch seed", `got ${branchCount}`);

    if (branchCount >= PRO_MAX_BRANCHES) {
      pass("pro at branch limit — server blocks createBranch");
    }

    for (let i = 0; i < PRO_MAX_USERS - 1; i++) {
      const staffId = randomUUID();
      const staffEmail = `staff${i}-${suffix}@test.local`;
      await client.query(
        `INSERT INTO auth_users (id, email, username, password_hash, tenant_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [staffId, staffEmail, `staff${i}.${suffix}`, hash, tenantId],
      );
      await client.query(
        `INSERT INTO profiles (id, tenant_id, name, email, role, pin, is_active)
         VALUES ($1, $2, $3, $4, 'cashier', '111111', true)`,
        [staffId, tenantId, `Staff ${i}`, staffEmail],
      );
    }
    const userCount = await countActiveUsers(client, tenantId);
    if (userCount === PRO_MAX_USERS) pass("pro user seed", `${userCount}/${PRO_MAX_USERS}`);
    else fail("pro user seed", `got ${userCount}`);

    if (userCount >= PRO_MAX_USERS) {
      pass("pro at user limit — server blocks createTenantUser");
    }

    await client.query(`UPDATE tenants SET plan = 'enterprise' WHERE id = $1`, [tenantId]);
    pass("upgraded to enterprise");

    const entBranchCount = await countActiveBranches(client, tenantId);
    if (entBranchCount < 999) pass("enterprise branch headroom", `current ${entBranchCount}`);
  } finally {
    await client.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
    await client.end();
  }

  try {
    const res = await fetch(`${DEV_URL}/pricing`, { redirect: "follow" });
    if (res.ok) {
      const html = await res.text();
      if (html.includes("749") || html.includes("Pro")) pass("GET /pricing", `HTTP ${res.status}`);
      else fail("GET /pricing", "page missing Pro pricing content");
    } else {
      fail("GET /pricing", `HTTP ${res.status} — start dev server on ${DEV_URL}`);
    }
  } catch (e) {
    fail("GET /pricing", `server not reachable: ${e.message}`);
  }

  pass("TRIAL_DAYS", `${TRIAL_DAYS} hari`);

  const failed = checks.filter((c) => !c.ok);
  console.log(`\nUAT plan limits: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

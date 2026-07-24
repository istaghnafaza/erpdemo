#!/usr/bin/env node
/**
 * UAT smoke test — Phase 6 cutover checklist (automated subset).
 * Usage: npm run neon:uat
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

function pass(name, detail) {
  checks.push({ name, ok: true, detail });
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
}

if (!url) {
  fail("DATABASE_URL", "Not set in .env");
  console.log(JSON.stringify({ ok: false, checks }, null, 2));
  process.exit(1);
}

if (process.env.VITE_DATA_BACKEND !== "neon") {
  fail("VITE_DATA_BACKEND", `Expected 'neon', got '${process.env.VITE_DATA_BACKEND ?? "(unset)"}'`);
} else {
  pass("VITE_DATA_BACKEND", "neon");
}

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
  fail("AUTH_SECRET", "Missing or too short (min 16 chars)");
} else {
  pass("AUTH_SECRET", "configured");
}

if (typeof globalThis.WebSocket === "undefined") {
  try {
    const { default: ws } = await import("ws");
    neonConfig.webSocketConstructor = ws;
  } catch {
    fail("ws", "Install ws for Node.js");
    console.log(JSON.stringify({ ok: false, checks }, null, 2));
    process.exit(1);
  }
}

const client = new Client(url);

try {
  await client.connect();

  const version = await client.query("SELECT version()");
  pass("postgres", version.rows[0]?.version?.slice(0, 40) ?? "connected");

  const tables = [
    "tenants",
    "auth_users",
    "sales_transactions",
    "purchase_orders",
    "accounts_receivable",
  ];
  for (const table of tables) {
    const r = await client.query(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS exists`,
    );
    if (r.rows[0]?.exists) pass(`table:${table}`, "exists");
    else fail(`table:${table}`, "missing — run npm run neon:setup");
  }

  const tenants = await client.query("SELECT count(*)::int AS n FROM tenants");
  pass("seed:tenants", `${tenants.rows[0]?.n ?? 0} tenant(s)`);

  const googleCol = await client.query(
    `SELECT count(*)::int AS n FROM information_schema.columns
     WHERE table_name = 'auth_users' AND column_name = 'google_sub'`,
  );
  if ((googleCol.rows[0]?.n ?? 0) > 0) pass("auth:google_sub", "column exists");
  else fail("auth:google_sub", "Run phase6_auth_google.sql migration");

  const allOk = checks.every((c) => c.ok);
  console.log(JSON.stringify({ ok: allOk, timestamp: new Date().toISOString(), checks }, null, 2));
  process.exit(allOk ? 0 : 1);
} catch (err) {
  fail("connection", err instanceof Error ? err.message : String(err));
  console.log(JSON.stringify({ ok: false, checks }, null, 2));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}

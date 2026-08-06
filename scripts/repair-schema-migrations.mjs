#!/usr/bin/env node
/**
 * Mark baseline Neon SQL files as applied when DB was created before schema_migrations tracking.
 * Usage: node scripts/repair-schema-migrations.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
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
if (!url) {
  console.error("ERROR: Set DATABASE_URL or DATABASE_URL_DIRECT in .env");
  process.exit(1);
}

if (typeof globalThis.WebSocket === "undefined") {
  const { default: ws } = await import("ws");
  neonConfig.webSocketConstructor = ws;
}

/** Files that must exist in DB before phase10+ were applied manually or via older flow. */
const BASELINE = [
  "phase1_schema.sql",
  "phase1_seed.sql",
  "phase2_schema.sql",
  "phase2_seed.sql",
  "phase2_index_branch_products_tenant_branch.sql",
  "phase3_schema.sql",
  "phase4_schema.sql",
  "phase4_seed.sql",
  "phase5_schema.sql",
  "phase6_auth_google.sql",
  "phase7_tenant_logo.sql",
  "phase8_schema.sql",
  "phase8_rls.sql",
  "phase9_auth_username.sql",
];

const client = new Client(url);

try {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = await client.query("SELECT filename FROM schema_migrations");
  const done = new Set(applied.rows.map((r) => r.filename));

  let inserted = 0;
  for (const file of BASELINE) {
    if (done.has(file)) continue;
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
    console.log(`marked ${file}`);
    inserted += 1;
  }

  const dir = join(root, "neon");
  const all = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const pending = all.filter((f) => !done.has(f) && !BASELINE.includes(f));

  console.log(
    JSON.stringify({ ok: true, baselineMarked: inserted, stillPending: pending }, null, 2),
  );
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: String(err) }, null, 2));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}

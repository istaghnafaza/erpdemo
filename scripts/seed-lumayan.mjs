#!/usr/bin/env node
/**
 * Seed tenant uji coba TB Lumayan ke Neon.
 * Usage: npm run neon:seed:lumayan
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, neonConfig } from "@neondatabase/serverless";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seedFile = "seed_tb_lumayan.sql";

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

const sql = readFileSync(join(root, "neon", seedFile), "utf8");
const client = new Client(url);

try {
  await client.connect();
  console.log(`[neon:seed:lumayan] applying ${seedFile}...`);
  await client.query(sql);

  const check = await client.query(
    `SELECT t.slug, t.name,
            (SELECT count(*) FROM profiles p WHERE p.tenant_id = t.id) AS users,
            (SELECT count(*) FROM products pr WHERE pr.tenant_id = t.id) AS products,
            (SELECT count(*) FROM customers c WHERE c.tenant_id = t.id) AS customers,
            (SELECT count(*) FROM suppliers s WHERE s.tenant_id = t.id) AS suppliers
     FROM tenants t WHERE t.slug = 'tb-lumayan'`,
  );

  console.log(JSON.stringify({ ok: true, tenant: check.rows[0] ?? null }, null, 2));
  console.log("");
  console.log("Login uji coba:");
  console.log("  URL:      https://seps.fazagroup.id/login");
  console.log("  Owner:    owner@seps.id / 111111");
  console.log("  Manager:  manager@seps.id / 111111");
  console.log("  Kasir:    kasir@seps.id / 111111");
  console.log("  Gudang:   gudang@seps.id / 111111");
} catch (err) {
  console.error(
    JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }, null, 2),
  );
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}

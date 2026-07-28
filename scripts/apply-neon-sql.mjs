#!/usr/bin/env node
/** Apply single SQL file to Neon (bypasses schema_migrations ledger). */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, neonConfig } from "@neondatabase/serverless";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2] ?? "neon/phase2_index_branch_products_tenant_branch.sql";

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

const sqlPath = join(root, file);
const sql = readFileSync(sqlPath, "utf8");
const client = new Client(url);

try {
  await client.connect();
  await client.query(sql);
  const check = await client.query(
    "SELECT indexname FROM pg_indexes WHERE tablename = $1 AND indexname = $2",
    ["branch_products", "idx_branch_products_tenant_branch"],
  );
  console.log(JSON.stringify({ ok: true, file, indexes: check.rows }, null, 2));
} catch (err) {
  console.error(
    JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }, null, 2),
  );
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}

#!/usr/bin/env node
/**
 * Apply pending Neon SQL migrations from neon/*.sql
 * Usage: npm run neon:migrate
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

  const dir = join(root, "neon");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (done.has(file)) {
      console.log(`skip  ${file}`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    console.log(`apply ${file}...`);
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
    count += 1;
    console.log(`ok    ${file}`);
  }

  console.log(JSON.stringify({ ok: true, applied: count, total: files.length }, null, 2));
} catch (err) {
  console.error(
    JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }, null, 2),
  );
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}

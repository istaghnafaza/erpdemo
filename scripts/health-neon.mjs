#!/usr/bin/env node
/**
 * Smoke test Neon connectivity (Phase 6 cutover).
 * Usage: npm run neon:health
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

if (!url) {
  console.error("ERROR: Set DATABASE_URL or DATABASE_URL_DIRECT in .env");
  process.exit(1);
}

if (typeof globalThis.WebSocket === "undefined") {
  try {
    const { default: ws } = await import("ws");
    neonConfig.webSocketConstructor = ws;
  } catch {
    console.error("ERROR: Install ws for Node.js WebSocket support: npm i -D ws");
    process.exit(1);
  }
}

const client = new Client(url);

try {
  await client.connect();

  const version = await client.query("SELECT version()");
  const tenants = await client.query("SELECT count(*)::int AS n FROM tenants");
  const backend = process.env.VITE_DATA_BACKEND ?? "(unset)";

  const report = {
    ok: true,
    timestamp: new Date().toISOString(),
    backend,
    postgresVersion: version.rows[0]?.version ?? "unknown",
    tenantCount: tenants.rows[0]?.n ?? 0,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }, null, 2));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}

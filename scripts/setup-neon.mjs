#!/usr/bin/env node
/**
 * Apply neon/*.sql to DATABASE_URL (direct connection recommended).
 * Usage: node scripts/setup-neon.mjs
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

if (!url) {
  console.error("ERROR: Set DATABASE_URL or DATABASE_URL_DIRECT in .env");
  process.exit(1);
}

const files = [
  "neon/phase1_schema.sql",
  "neon/phase1_seed.sql",
  "neon/phase2_schema.sql",
  "neon/phase2_seed.sql",
  "neon/phase3_schema.sql",
  "neon/phase4_schema.sql",
  "neon/phase4_seed.sql",
  "neon/phase5_schema.sql",
  "neon/phase6_auth_google.sql",
];

const client = new Client({ connectionString: url });
await client.connect();

for (const file of files) {
  const path = join(root, file);
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    console.warn(`SKIP (missing): ${file}`);
    continue;
  }
  console.log(`Applying ${file}...`);
  if (file.includes("_seed.sql")) {
    await client.query("DROP TABLE IF EXISTS _ids");
  }
  await client.query(content);
  console.log(`  OK`);
}

await client.end();
console.log("\nNeon setup complete.");

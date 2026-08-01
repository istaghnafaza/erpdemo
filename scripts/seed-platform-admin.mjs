#!/usr/bin/env node
/**
 * Create/update platform admin account from env.
 * Usage: npm run neon:seed:platform-admin
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

const username = process.env.PLATFORM_ADMIN_USERNAME?.trim().toLowerCase();
const password = process.env.PLATFORM_ADMIN_PASSWORD;
const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();

if (!username || !password || !email) {
  console.error(
    "ERROR: Set PLATFORM_ADMIN_USERNAME, PLATFORM_ADMIN_PASSWORD, PLATFORM_ADMIN_EMAIL in .env",
  );
  process.exit(1);
}

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error("ERROR: Set DATABASE_URL or DATABASE_URL_DIRECT in .env");
  process.exit(1);
}

if (typeof globalThis.WebSocket === "undefined") {
  const { default: ws } = await import("ws");
  neonConfig.webSocketConstructor = ws;
}

const passwordHash = await bcrypt.hash(password, 10);
const client = new Client(url);

try {
  await client.connect();

  const existing = await client.query(
    `SELECT id FROM auth_users
     WHERE lower(username) = $1 OR lower(email) = $2
     LIMIT 1`,
    [username, email],
  );

  if (existing.rows[0]?.id) {
    await client.query(
      `UPDATE auth_users
       SET email = $2, username = $3, password_hash = $4, tenant_id = NULL, is_platform_admin = TRUE
       WHERE id = $1`,
      [existing.rows[0].id, email, username, passwordHash],
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          created: false,
          updated: true,
          username,
          email,
          dashboardUrl: "/platform/dashboard",
        },
        null,
        2,
      ),
    );
  } else {
    const id = randomUUID();
    await client.query(
      `INSERT INTO auth_users (id, email, username, password_hash, tenant_id, is_platform_admin)
       VALUES ($1, $2, $3, $4, NULL, TRUE)`,
      [id, email, username, passwordHash],
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          created: true,
          updated: false,
          username,
          email,
          dashboardUrl: "/platform/dashboard",
        },
        null,
        2,
      ),
    );
  }
} finally {
  await client.end();
}

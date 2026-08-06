#!/usr/bin/env node
/**
 * Close duplicate open cashier_sessions — keep newest per tenant+branch+cashier.
 * Usage:
 *   node scripts/close-orphan-cashier-sessions.mjs [--dry-run] [--tenant-slug=tb-arkananta]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, neonConfig } from "@neondatabase/serverless";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
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

const dryRun = process.argv.includes("--dry-run");
const tenantSlugArg = process.argv.find((a) => a.startsWith("--tenant-slug="));
const tenantSlugFilter = tenantSlugArg?.split("=")[1];

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env");
  process.exit(1);
}

if (typeof globalThis.WebSocket === "undefined") {
  const { default: ws } = await import("ws");
  neonConfig.webSocketConstructor = ws;
}

const client = new Client(url);
await client.connect();

let tenantFilter = "";
const params = [];
if (tenantSlugFilter) {
  tenantFilter = `AND cs.tenant_id = (SELECT id FROM tenants WHERE slug = $1)`;
  params.push(tenantSlugFilter);
}

const { rows: openRows } = await client.query(
  `
  SELECT cs.id, cs.tenant_id, cs.branch_id, cs.cashier_id, cs.opened_at, t.slug AS tenant_slug
  FROM cashier_sessions cs
  JOIN tenants t ON t.id = cs.tenant_id
  WHERE cs.status = 'open'
  ${tenantFilter}
  ORDER BY cs.opened_at DESC
  `,
  params,
);

const groups = new Map();
for (const row of openRows) {
  const key = `${row.tenant_id}:${row.branch_id}:${row.cashier_id}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}

const toClose = [];
for (const [, sessions] of groups) {
  if (sessions.length <= 1) continue;
  for (let i = 1; i < sessions.length; i++) {
    toClose.push(sessions[i]);
  }
}

console.log(
  JSON.stringify(
    {
      dryRun,
      tenantSlugFilter: tenantSlugFilter ?? "all",
      openSessions: openRows.length,
      groupsWithDuplicates: [...groups.values()].filter((g) => g.length > 1).length,
      toClose: toClose.length,
    },
    null,
    2,
  ),
);

for (const s of toClose) {
  const label = `${s.tenant_slug} session ${s.id.slice(0, 8)}… opened ${s.opened_at}`;
  if (dryRun) {
    console.log(`[dry-run] would close ${label}`);
    continue;
  }
  await client.query(
    `
    UPDATE cashier_sessions
    SET status = 'closed',
        closed_at = NOW(),
        notes = COALESCE(notes || E'\\n', '') || 'Auto-closed: duplicate open session (housekeeping)'
    WHERE id = $1 AND status = 'open'
    `,
    [s.id],
  );
  console.log(`closed ${label}`);
}

await client.end();
console.log(dryRun ? "Done (dry-run)." : "Done.");

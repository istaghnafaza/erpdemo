/**
 * Generate Railway Variables block from local .env (for copy-paste to Railway Raw Editor).
 * Output: .env.railway.local (gitignored) — never commit secrets.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const outPath = join(root, ".env.railway.local");

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

function requireKey(map, key) {
  const v = map.get(key)?.trim();
  if (!v) {
    console.error(`[railway:env] Missing ${key} in .env — isi dulu sebelum deploy.`);
    process.exit(1);
  }
  return v;
}

if (!existsSync(envPath)) {
  console.error("[railway:env] File .env tidak ditemukan. Copy dari .env.example dan isi Neon.");
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));

const databaseUrl = requireKey(env, "DATABASE_URL");
const databaseUrlDirect = env.get("DATABASE_URL_DIRECT")?.trim() || databaseUrl;
const authSecret =
  env.get("RAILWAY_AUTH_SECRET")?.trim() ||
  randomBytes(32).toString("base64url");

const lines = [
  "# Paste ke Railway → service erpdemo → Variables → Raw Editor",
  "# Setelah save → Deployments → Redeploy",
  "",
  `DATABASE_URL=${databaseUrl}`,
  `DATABASE_URL_DIRECT=${databaseUrlDirect}`,
  `AUTH_SECRET=${authSecret}`,
  "AUTH_URL=https://seps.fazagroup.id",
  "",
  "VITE_DATA_BACKEND=neon",
  "VITE_APP_NAME=SEPS",
  "VITE_APP_ENV=staging",
  "NODE_ENV=production",
  "",
];

const googleClientId = env.get("VITE_GOOGLE_CLIENT_ID")?.trim();
const googleSecret = env.get("GOOGLE_CLIENT_SECRET")?.trim();
if (googleClientId && googleSecret) {
  lines.push(
    "# Google OAuth (opsional — sudah ada di .env lokal)",
    `VITE_GOOGLE_CLIENT_ID=${googleClientId}`,
    `GOOGLE_CLIENT_ID=${env.get("GOOGLE_CLIENT_ID")?.trim() || googleClientId}`,
    `GOOGLE_CLIENT_SECRET=${googleSecret}`,
    "VITE_PUBLIC_APP_URL=https://seps.fazagroup.id",
    "",
  );
}

writeFileSync(outPath, lines.join("\n"), "utf8");

console.log(`[railway:env] OK — salin isi file ini ke Railway Variables:`);
console.log(`  ${outPath}`);
console.log("");
console.log("Langkah:");
console.log("  1. Railway → erpdemo → Variables → Raw Editor → paste → Save");
console.log("  2. Deployments → Redeploy");
console.log("  3. Uji https://seps.fazagroup.id/login");

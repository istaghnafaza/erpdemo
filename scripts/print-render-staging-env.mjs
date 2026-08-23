/**
 * Generate env for Render staging (paste to Environment → Secret Files / raw).
 * Output: .env.render.staging.local
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stagingLocal = join(root, ".env.staging.local");
const prodEnv = join(root, ".env");
const outPath = join(root, ".env.render.staging.local");

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

let map;
if (existsSync(stagingLocal)) {
  map = parseEnv(readFileSync(stagingLocal, "utf8"));
  console.log("[render:env] Using .env.staging.local");
} else if (existsSync(prodEnv)) {
  map = new Map(parseEnv(readFileSync(prodEnv, "utf8")));
  map.set("AUTH_SECRET", randomBytes(32).toString("base64url"));
  console.log("[render:env] WARNING: .env.staging.local missing — using .env DATABASE_URL");
} else {
  console.error("No .env.staging.local or .env found");
  process.exit(1);
}

const databaseUrl = map.get("DATABASE_URL")?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const lines = [
  `DATABASE_URL=${databaseUrl}`,
  `DATABASE_URL_DIRECT=${map.get("DATABASE_URL_DIRECT")?.trim() || databaseUrl}`,
  `AUTH_SECRET=${map.get("AUTH_SECRET")?.trim() || randomBytes(32).toString("base64url")}`,
  "AUTH_URL=https://staging.seps.fazagroup.id",
  "VITE_DATA_BACKEND=neon",
  "VITE_APP_NAME=SEPS Staging",
  "VITE_APP_ENV=staging",
  "VITE_PUBLIC_APP_URL=https://staging.seps.fazagroup.id",
  "NODE_ENV=production",
  "HOST=0.0.0.0",
  "NITRO_HOST=0.0.0.0",
];

const googleClientId = map.get("VITE_GOOGLE_CLIENT_ID")?.trim();
const googleSecret = map.get("GOOGLE_CLIENT_SECRET")?.trim();
if (googleClientId && googleSecret) {
  lines.push(
    `VITE_GOOGLE_CLIENT_ID=${googleClientId}`,
    `GOOGLE_CLIENT_ID=${map.get("GOOGLE_CLIENT_ID")?.trim() || googleClientId}`,
    `GOOGLE_CLIENT_SECRET=${googleSecret}`,
  );
}

const midtransServer = map.get("MIDTRANS_SERVER_KEY")?.trim();
const midtransClient = map.get("MIDTRANS_CLIENT_KEY")?.trim();
if (midtransServer && midtransClient) {
  lines.push(
    `MIDTRANS_SERVER_KEY=${midtransServer}`,
    `MIDTRANS_CLIENT_KEY=${midtransClient}`,
    `MIDTRANS_IS_PRODUCTION=${map.get("MIDTRANS_IS_PRODUCTION")?.trim() || "false"}`,
  );
}

writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
console.log(`[render:env] OK → ${outPath}`);
console.log("Render → Environment → Add from .env (jangan set PORT; Render yang mengisi).");
console.log("Setelah URL onrender.com muncul, samakan AUTH_URL + VITE_PUBLIC_APP_URL lalu Redeploy.");

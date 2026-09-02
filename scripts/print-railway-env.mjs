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

/** Tanpa baris komentar — aman untuk Railway Raw Editor (replace ALL variables). */
const lines = [
  `DATABASE_URL=${databaseUrl}`,
  `DATABASE_URL_DIRECT=${databaseUrlDirect}`,
  `AUTH_SECRET=${authSecret}`,
  "AUTH_URL=https://seps.fazagroup.id",
  "PORT=8080",
  "VITE_DATA_BACKEND=neon",
  "VITE_APP_NAME=SEPS",
  "VITE_APP_ENV=production",
  "NODE_ENV=production",
];

const googleClientId = env.get("VITE_GOOGLE_CLIENT_ID")?.trim();
const googleSecret = env.get("GOOGLE_CLIENT_SECRET")?.trim();
if (googleClientId && googleSecret) {
  lines.push(
    `VITE_GOOGLE_CLIENT_ID=${googleClientId}`,
    `GOOGLE_CLIENT_ID=${env.get("GOOGLE_CLIENT_ID")?.trim() || googleClientId}`,
    `GOOGLE_CLIENT_SECRET=${googleSecret}`,
    "VITE_PUBLIC_APP_URL=https://seps.fazagroup.id",
  );
}

const midtransServer = env.get("MIDTRANS_SERVER_KEY")?.trim();
const midtransClient = env.get("MIDTRANS_CLIENT_KEY")?.trim();
if (midtransServer && midtransClient) {
  lines.push(
    `MIDTRANS_SERVER_KEY=${midtransServer}`,
    `MIDTRANS_CLIENT_KEY=${midtransClient}`,
    `MIDTRANS_IS_PRODUCTION=${env.get("MIDTRANS_IS_PRODUCTION")?.trim() || "true"}`,
    "MIDTRANS_NOTIFICATION_URL=https://seps.fazagroup.id/api/midtrans/notification",
  );
}

const resendKey = env.get("RESEND_API_KEY")?.trim();
if (resendKey) {
  lines.push(`RESEND_API_KEY=${resendKey}`);
  const from = env.get("RESEND_FROM_EMAIL")?.trim();
  if (from) lines.push(`RESEND_FROM_EMAIL=${from}`);
}

const smtpHost = env.get("SMTP_HOST")?.trim();
const smtpUser = env.get("SMTP_USER")?.trim();
const smtpPass = env.get("SMTP_PASS")?.trim();
if (smtpHost && smtpUser && smtpPass) {
  lines.push(
    `SMTP_HOST=${smtpHost}`,
    `SMTP_PORT=${env.get("SMTP_PORT")?.trim() || "465"}`,
    `SMTP_SECURE=${env.get("SMTP_SECURE")?.trim() || "true"}`,
    `SMTP_USER=${smtpUser}`,
    `SMTP_PASS=${smtpPass}`,
  );
  const smtpFrom = env.get("SMTP_FROM")?.trim();
  if (smtpFrom) lines.push(`SMTP_FROM=${smtpFrom}`);
}

const fonnte = env.get("FONNTE_TOKEN")?.trim();
if (fonnte) lines.push(`FONNTE_TOKEN=${fonnte}`);

const tgToken = env.get("PLAN_OPS_TELEGRAM_BOT_TOKEN")?.trim();
const tgChat = env.get("PLAN_OPS_TELEGRAM_CHAT_ID")?.trim();
if (tgToken && tgChat) {
  lines.push(
    `PLAN_OPS_TELEGRAM_BOT_TOKEN=${tgToken}`,
    `PLAN_OPS_TELEGRAM_CHAT_ID=${tgChat}`,
  );
}

writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");

console.log(`[railway:env] OK — salin SEMUA baris ke Railway Variables (Raw Editor):`);
console.log(`  ${outPath}`);
console.log("");
console.log("PENTING:");
console.log("  - Buka service erpdemo (bukan project-level saja)");
console.log("  - Raw Editor → paste → Save (mengganti SEMUA variable service)");
console.log("  - JANGAN pakai tanda kutip di value (salah: DATABASE_URL=\"...\", benar: DATABASE_URL=...)");
console.log("  - Setelah Save, klik banner ungu 'Staged changes' di canvas → Deploy");
console.log("  - JANGAN hanya Redeploy dari menu Deployments — itu tidak apply variable baru");
console.log("  - Deploy Logs harus tampil: [SEPS] env database=ok auth=ok");

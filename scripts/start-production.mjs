/**
 * Production entry — sanitize Railway env, log sanity, lalu start Nitro.
 */

function readEnv(name) {
  const raw = process.env[name];
  if (raw == null) return undefined;
  let value = String(raw).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value.length > 0 ? value : undefined;
}

const ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_DIRECT",
  "AUTH_SECRET",
  "AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "VITE_DATA_BACKEND",
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_PUBLIC_APP_URL",
  "PORT",
  "HOST",
  "NITRO_HOST",
  "NODE_ENV",
];

for (const key of ENV_KEYS) {
  const cleaned = readEnv(key);
  if (cleaned !== undefined) process.env[key] = cleaned;
}

const port = process.env.PORT ?? "(unset)";
const host = process.env.HOST ?? process.env.NITRO_HOST ?? "(unset)";

process.env.HOST = process.env.HOST || "0.0.0.0";
process.env.NITRO_HOST = process.env.NITRO_HOST || "0.0.0.0";

const databaseUrl = readEnv("DATABASE_URL_DIRECT") || readEnv("DATABASE_URL");
const hasDatabase = Boolean(databaseUrl);
const hasAuthSecret = Boolean(readEnv("AUTH_SECRET") && readEnv("AUTH_SECRET").length >= 16);
const presentKeys = ENV_KEYS.filter((key) => Boolean(readEnv(key)));

console.log(`[SEPS] starting server host=${host} port=${port} node=${process.version}`);
console.log(
  `[SEPS] env database=${hasDatabase ? "ok" : "MISSING"} auth=${hasAuthSecret ? "ok" : "MISSING"} auth_url=${readEnv("AUTH_URL") ?? "(unset)"}`,
);
console.log(`[SEPS] env keys present: ${presentKeys.join(", ") || "(none)"}`);

if (!hasDatabase) {
  console.error(
    "[SEPS] DATABASE_URL tidak ada di runtime container.",
  );
  console.error(
    "[SEPS] Railway/Render: DATABASE_URL harus ada di Environment service (value tanpa tanda kutip), lalu Redeploy.",
  );
  console.error(
    "[SEPS] Jangan set PORT di Render — platform yang mengisi. Host 0.0.0.0.",
  );
}

const allEnvKeys = Object.keys(process.env).sort();
console.log(`[SEPS] process.env total keys=${allEnvKeys.length} (custom vars should include DATABASE_URL, AUTH_SECRET)`);

await import("../.output/server/index.mjs");

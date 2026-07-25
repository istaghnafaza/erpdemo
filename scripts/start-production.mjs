/**
 * Production entry — log PORT/HOST + env sanity, lalu start Nitro.
 */
const port = process.env.PORT ?? "(unset)";
const host = process.env.HOST ?? process.env.NITRO_HOST ?? "(unset)";

process.env.HOST = process.env.HOST || "0.0.0.0";
process.env.NITRO_HOST = process.env.NITRO_HOST || "0.0.0.0";

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_DIRECT);
const hasAuthSecret = Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16);

console.log(`[SEPS] starting server host=${host} port=${port} node=${process.version}`);
console.log(
  `[SEPS] env database=${hasDatabase ? "ok" : "MISSING"} auth=${hasAuthSecret ? "ok" : "MISSING"} auth_url=${process.env.AUTH_URL ?? "(unset)"}`,
);

if (!hasDatabase) {
  console.error(
    "[SEPS] DATABASE_URL tidak ada di runtime — Railway → service erpdemo → Variables → paste dari .env.railway.local → Save → Redeploy",
  );
}

await import("../.output/server/index.mjs");

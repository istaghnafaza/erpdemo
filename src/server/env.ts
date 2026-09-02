// =============================================================================
// Runtime env helpers — strip accidental quotes from Railway Raw Editor pastes
// =============================================================================

/**
 * Read a process env var safely.
 * Railway Raw Editor pastes sometimes include surrounding quotes as part of the value.
 */
export function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw == null) return undefined;

  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value.length > 0 ? value : undefined;
}

export function hasEnv(name: string): boolean {
  return Boolean(readEnv(name));
}

/** Normalize known SEPS env keys in-place (startup only). */
export function sanitizeProcessEnv(keys: string[]): void {
  for (const key of keys) {
    const cleaned = readEnv(key);
    if (cleaned !== undefined) {
      process.env[key] = cleaned;
    } else if (process.env[key] != null && process.env[key]!.trim() === "") {
      delete process.env[key];
    }
  }
}

export function getDatabaseUrl(): string | undefined {
  return readEnv("DATABASE_URL_DIRECT") || readEnv("DATABASE_URL");
}

export function getReadDatabaseUrl(): string | undefined {
  return readEnv("DATABASE_URL_REPLICA");
}

const SERVER_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_DIRECT",
  "DATABASE_URL_REPLICA",
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
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "PLATFORM_ADMIN_USERNAME",
  "PLATFORM_ADMIN_PASSWORD",
  "PLATFORM_ADMIN_EMAIL",
  "PLATFORM_ADMIN_NAME",
  "MIDTRANS_SERVER_KEY",
  "MIDTRANS_CLIENT_KEY",
  "MIDTRANS_IS_PRODUCTION",
  "MIDTRANS_NOTIFICATION_URL",
  "PLAN_OPS_TELEGRAM_BOT_TOKEN",
  "PLAN_OPS_TELEGRAM_CHAT_ID",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM",
  "FONNTE_TOKEN",
] as const;

/** Which expected keys exist in process.env (helps debug Railway misconfiguration). */
export function getEnvKeyPresence(): Record<string, "missing" | "empty" | "set"> {
  const out: Record<string, "missing" | "empty" | "set"> = {};
  for (const key of SERVER_ENV_KEYS) {
    const raw = process.env[key];
    if (raw == null) out[key] = "missing";
    else if (raw.trim() === "") out[key] = "empty";
    else out[key] = "set";
  }
  return out;
}

export function getEnvDiagnostics() {
  const databaseUrlDirect = readEnv("DATABASE_URL_DIRECT");
  const databaseUrl = readEnv("DATABASE_URL");
  const authSecret = readEnv("AUTH_SECRET");
  const authUrl = readEnv("AUTH_URL");

  let databaseUrlSource: "DATABASE_URL_DIRECT" | "DATABASE_URL" | null = null;
  if (databaseUrlDirect) databaseUrlSource = "DATABASE_URL_DIRECT";
  else if (databaseUrl) databaseUrlSource = "DATABASE_URL";

  return {
    databaseConfigured: Boolean(databaseUrlDirect || databaseUrl),
    databaseUrlSource,
    readReplicaConfigured: Boolean(readEnv("DATABASE_URL_REPLICA")),
    authSecretConfigured: Boolean(authSecret && authSecret.length >= 16),
    authUrl: authUrl ?? null,
    viteDataBackend: readEnv("VITE_DATA_BACKEND") ?? null,
    nodeEnv: readEnv("NODE_ENV") ?? null,
    port: readEnv("PORT") ?? null,
    redisConfigured: hasEnv("UPSTASH_REDIS_REST_URL") && hasEnv("UPSTASH_REDIS_REST_TOKEN"),
    /** Raw presence — "missing" = key tidak ada di container (salah service / belum redeploy). */
    keys: getEnvKeyPresence(),
  };
}

if (typeof process !== "undefined" && process.env) {
  sanitizeProcessEnv([...SERVER_ENV_KEYS]);
}

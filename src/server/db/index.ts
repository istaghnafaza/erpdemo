// =============================================================================
// Neon Drizzle client (server-only) — WebSocket Pool for transaction support
// =============================================================================

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

export function getDb() {
  if (_db) return _db;

  const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "[SES] DATABASE_URL belum diset. Railway → Variables → isi DATABASE_URL + DATABASE_URL_DIRECT dari Neon, lalu Redeploy.",
    );
  }

  const pool = new Pool({ connectionString: url });
  _db = drizzle(pool, { schema });
  return _db;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_DIRECT);
}

export { schema };

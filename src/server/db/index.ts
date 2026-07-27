// =============================================================================
// Neon Drizzle client (server-only) — WebSocket Pool for transaction support
// =============================================================================

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { getDatabaseUrl } from "@/server/env";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

export function getDb() {
  if (_db) return _db;

  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "[SES] DATABASE_URL belum diset di runtime container. Pastikan Variables ada di service Railway yang melayani seps.fazagroup.id (bukan service lain), tanpa tanda kutip di value, lalu Redeploy. Cek /health untuk status env.",
    );
  }

  const pool = new Pool({ connectionString: url });
  _db = drizzle(pool, { schema });
  return _db;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

export { schema };

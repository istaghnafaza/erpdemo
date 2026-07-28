// =============================================================================
// Neon Drizzle client (server-only) — WebSocket Pool for transaction support
// Phase C: optional read replica for report/dashboard reads
// =============================================================================

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { getDatabaseUrl, getReadDatabaseUrl } from "@/server/env";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _writeDb: Db | null = null;
let _readDb: Db | null = null;

if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

function createPool(url: string) {
  return new Pool({ connectionString: url });
}

function createDb(url: string): Db {
  return drizzle(createPool(url), { schema });
}

/** Primary DB — writes and reads when no replica configured. */
export function getWriteDb(): Db {
  if (_writeDb) return _writeDb;

  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "[SES] DATABASE_URL belum diset di runtime container. Pastikan Variables ada di service Railway yang melayani seps.fazagroup.id (bukan service lain), tanpa tanda kutip di value, lalu Redeploy. Cek /health untuk status env.",
    );
  }

  _writeDb = createDb(url);
  return _writeDb;
}

/** Read replica when DATABASE_URL_REPLICA is set; otherwise primary. */
export function getReadDb(): Db {
  const replicaUrl = getReadDatabaseUrl();
  if (!replicaUrl) return getWriteDb();

  if (!_readDb) {
    _readDb = createDb(replicaUrl);
  }
  return _readDb;
}

/** @deprecated Use getWriteDb() for writes or getReadDb() for reads. */
export function getDb(): Db {
  return getWriteDb();
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

export function isReadReplicaConfigured(): boolean {
  return Boolean(getReadDatabaseUrl());
}

export { schema };

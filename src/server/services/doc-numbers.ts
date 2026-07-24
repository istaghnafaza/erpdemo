import { and, eq, like, sql } from "drizzle-orm";
import type { getDb } from "@/server/db";

type Db = ReturnType<typeof getDb>;

export async function nextDocNumberForTable(
  db: Db,
  table: Parameters<Db["select"]>[0],
  tenantIdColumn: unknown,
  numberColumn: unknown,
  tenantId: string,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(and(eq(tenantIdColumn as never, tenantId), like(numberColumn as never, pattern)));
  return `${prefix}-${year}-${String((row?.count ?? 0) + 1).padStart(4, "0")}`;
}

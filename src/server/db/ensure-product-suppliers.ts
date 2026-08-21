// =============================================================================
// Idempotent schema guard — product_suppliers (supplier ↔ produk)
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";

let ensured = false;
let ensuring: Promise<void> | null = null;

export async function ensureProductSuppliersTable(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    const db = getWriteDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_suppliers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
        supplier_id UUID NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
        is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
        UNIQUE (tenant_id, product_id, supplier_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_product_suppliers_product
      ON product_suppliers (tenant_id, product_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier
      ON product_suppliers (tenant_id, supplier_id)
    `);
    await db.execute(sql`
      ALTER TABLE product_suppliers
        ADD COLUMN IF NOT EXISTS last_purchase_price bigint NOT NULL DEFAULT 0
    `);
    ensured = true;
  })();

  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

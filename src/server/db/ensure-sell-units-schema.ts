// =============================================================================
// Idempotent schema — product sell units + decimal stock (phase 16)
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";

let ensured = false;
let ensuring: Promise<void> | null = null;

export async function ensureSellUnitsSchema(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    const db = getWriteDb();
    await db.execute(sql`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_unit text
    `);
    await db.execute(sql`
      UPDATE products SET stock_unit = unit WHERE stock_unit IS NULL
    `);
    await db.execute(sql`
      ALTER TABLE branch_products
        ALTER COLUMN stock TYPE numeric(18, 4) USING stock::numeric
    `);
    await db.execute(sql`
      ALTER TABLE branch_products
        ALTER COLUMN legacy_stock TYPE numeric(18, 4) USING legacy_stock::numeric
    `);
    await db.execute(sql`
      ALTER TABLE stock_movements
        ALTER COLUMN qty TYPE numeric(18, 4) USING qty::numeric
    `);
    await db.execute(sql`
      ALTER TABLE stock_movements
        ALTER COLUMN qty_before TYPE numeric(18, 4) USING qty_before::numeric
    `);
    await db.execute(sql`
      ALTER TABLE stock_movements
        ALTER COLUMN qty_after TYPE numeric(18, 4) USING qty_after::numeric
    `);
    await db.execute(sql`
      ALTER TABLE sales_items
        ALTER COLUMN qty TYPE numeric(18, 4) USING qty::numeric
    `);
    await db.execute(sql`
      ALTER TABLE sales_items ADD COLUMN IF NOT EXISTS sell_unit_id uuid
    `);
    await db.execute(sql`
      ALTER TABLE sales_items ADD COLUMN IF NOT EXISTS sell_unit_label text
    `);
    await db.execute(sql`
      ALTER TABLE sales_items ADD COLUMN IF NOT EXISTS qty_base numeric(18, 4)
    `);
    await db.execute(sql`
      ALTER TABLE sales_items ADD COLUMN IF NOT EXISTS factor_to_base numeric(18, 6)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_sell_units (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        label text NOT NULL,
        factor_to_base numeric(18, 6) NOT NULL DEFAULT 1,
        selling_price bigint,
        purchase_price bigint,
        sort_order integer NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        allow_fraction boolean NOT NULL DEFAULT false,
        preset_qty jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (product_id, label)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_product_sell_units_product
        ON product_sell_units (product_id)
        WHERE is_active = true
    `);
    await db.execute(sql`
      ALTER TABLE product_sell_units
        ADD COLUMN IF NOT EXISTS allow_fraction boolean NOT NULL DEFAULT false
    `);
    await db.execute(sql`
      ALTER TABLE product_sell_units
        ADD COLUMN IF NOT EXISTS preset_qty jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
    ensured = true;
  })();

  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

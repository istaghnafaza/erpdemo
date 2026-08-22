// =============================================================================
// Idempotent schema — stock_status, ownership, PO pay/ownership modes
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";

let ensured = false;
let ensuring: Promise<void> | null = null;

export async function ensureStockOwnershipSchema(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    const db = getWriteDb();

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE stock_status AS ENUM ('new', 'unverified', 'verified');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE stock_ownership AS ENUM ('owned', 'consignment');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE po_ownership AS ENUM ('owned', 'consignment');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE po_pay_trigger AS ENUM ('on_receipt_credit', 'on_receipt_cash', 'on_sale');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await db.execute(sql`
      ALTER TABLE branch_products
        ADD COLUMN IF NOT EXISTS stock_status stock_status NOT NULL DEFAULT 'verified'
    `);
    await db.execute(sql`
      ALTER TABLE branch_products
        ADD COLUMN IF NOT EXISTS stock_ownership stock_ownership NOT NULL DEFAULT 'owned'
    `);
    await db.execute(sql`
      ALTER TABLE branch_products
        ADD COLUMN IF NOT EXISTS consignment_supplier_id uuid
          REFERENCES suppliers(id) ON DELETE SET NULL
    `);

    await db.execute(sql`
      ALTER TABLE purchase_orders
        ADD COLUMN IF NOT EXISTS ownership_mode po_ownership NOT NULL DEFAULT 'owned'
    `);
    await db.execute(sql`
      ALTER TABLE purchase_orders
        ADD COLUMN IF NOT EXISTS pay_trigger po_pay_trigger NOT NULL DEFAULT 'on_receipt_credit'
    `);
    await db.execute(sql`
      ALTER TABLE purchase_orders
        ADD COLUMN IF NOT EXISTS discount_amount bigint NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      ALTER TABLE purchase_orders
        ADD COLUMN IF NOT EXISTS rebate_after_qty integer
    `);
    await db.execute(sql`
      ALTER TABLE purchase_orders
        ADD COLUMN IF NOT EXISTS rebate_per_unit bigint NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      ALTER TABLE purchase_orders
        ADD COLUMN IF NOT EXISTS consignment_sold_qty integer NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      ALTER TABLE product_suppliers
        ADD COLUMN IF NOT EXISTS last_purchase_price bigint NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      ALTER TABLE purchase_order_items
        ADD COLUMN IF NOT EXISTS selling_price bigint
    `);

    // Migrasi legacy_stock → stock + unverified (satu angka stok)
    await db.execute(sql`
      UPDATE branch_products
      SET
        stock = (COALESCE(stock::numeric, 0) + COALESCE(legacy_stock::numeric, 0)),
        stock_status = CASE
          WHEN COALESCE(legacy_stock::numeric, 0) > 0 THEN 'unverified'::stock_status
          ELSE stock_status
        END,
        legacy_stock = 0
      WHERE COALESCE(legacy_stock::numeric, 0) > 0
    `);

    ensured = true;
  })();

  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

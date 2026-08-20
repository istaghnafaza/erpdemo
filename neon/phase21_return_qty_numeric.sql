-- Phase 21: qty retur mengikuti sales_items.qty (numeric), bukan INT.
-- Insert "1.0000" ke qty_sold INT gagal di Postgres.

ALTER TABLE sales_items
  ALTER COLUMN qty_returned TYPE numeric(18, 4) USING qty_returned::numeric;

ALTER TABLE sales_return_items
  ALTER COLUMN qty_sold TYPE numeric(18, 4) USING qty_sold::numeric,
  ALTER COLUMN qty_requested TYPE numeric(18, 4) USING qty_requested::numeric,
  ALTER COLUMN qty_qc_passed TYPE numeric(18, 4) USING qty_qc_passed::numeric;

ALTER TABLE product_sell_units
  ADD COLUMN IF NOT EXISTS allow_fraction boolean NOT NULL DEFAULT false;

ALTER TABLE product_sell_units
  ADD COLUMN IF NOT EXISTS preset_qty jsonb NOT NULL DEFAULT '[]'::jsonb;

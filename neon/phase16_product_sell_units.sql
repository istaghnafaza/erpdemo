-- Phase 16: multi-unit sell (barang curah) + decimal stock
-- Satu produk, stok satuan dasar; banyak satuan jual dengan faktor konversi.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_unit text;

UPDATE products
SET stock_unit = unit
WHERE stock_unit IS NULL;

ALTER TABLE branch_products
  ALTER COLUMN stock TYPE numeric(18, 4) USING stock::numeric,
  ALTER COLUMN legacy_stock TYPE numeric(18, 4) USING legacy_stock::numeric;

ALTER TABLE stock_movements
  ALTER COLUMN qty TYPE numeric(18, 4) USING qty::numeric,
  ALTER COLUMN qty_before TYPE numeric(18, 4) USING qty_before::numeric,
  ALTER COLUMN qty_after TYPE numeric(18, 4) USING qty_after::numeric;

ALTER TABLE sales_items
  ALTER COLUMN qty TYPE numeric(18, 4) USING qty::numeric,
  ADD COLUMN IF NOT EXISTS sell_unit_id uuid,
  ADD COLUMN IF NOT EXISTS sell_unit_label text,
  ADD COLUMN IF NOT EXISTS qty_base numeric(18, 4),
  ADD COLUMN IF NOT EXISTS factor_to_base numeric(18, 6);

UPDATE sales_items
SET qty_base = qty
WHERE qty_base IS NULL;

UPDATE sales_items
SET factor_to_base = 1
WHERE factor_to_base IS NULL;

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
);

CREATE INDEX IF NOT EXISTS idx_product_sell_units_product
  ON product_sell_units (product_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_product_sell_units_tenant
  ON product_sell_units (tenant_id);

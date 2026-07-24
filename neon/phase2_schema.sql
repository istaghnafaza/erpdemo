-- =============================================================================
-- SES — Neon Phase 2 Schema (products, customers, stock movements)
-- Run AFTER phase1_schema.sql on existing Neon database.
-- =============================================================================

CREATE TYPE customer_type AS ENUM ('retail', 'credit');
CREATE TYPE stock_source AS ENUM ('verified', 'legacy', 'unverified');
CREATE TYPE movement_type AS ENUM (
  'in', 'out', 'adjustment', 'opname', 'transfer_out', 'transfer_in', 'legacy_in', 'legacy_out'
);

CREATE TABLE product_categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_product_categories_tenant_id ON product_categories (tenant_id);

CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  sku            TEXT NOT NULL,
  barcode        TEXT,
  name           TEXT NOT NULL,
  category_id    UUID REFERENCES product_categories (id) ON DELETE SET NULL,
  unit           TEXT NOT NULL DEFAULT 'pcs',
  purchase_price BIGINT NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sku)
);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_products_tenant_id ON products (tenant_id);
CREATE INDEX idx_products_sku ON products (tenant_id, sku);

CREATE TABLE branch_products (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id          UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  selling_price      BIGINT NOT NULL DEFAULT 0,
  stock              INTEGER NOT NULL DEFAULT 0,
  legacy_stock       INTEGER NOT NULL DEFAULT 0,
  reorder_point      INTEGER NOT NULL DEFAULT 0,
  warehouse_location TEXT,
  UNIQUE (branch_id, product_id)
);

CREATE INDEX idx_branch_products_tenant_id ON branch_products (tenant_id);
CREATE INDEX idx_branch_products_branch_id ON branch_products (branch_id);

CREATE TABLE customers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  phone            TEXT,
  address          TEXT,
  type             customer_type NOT NULL DEFAULT 'retail',
  credit_limit     BIGINT NOT NULL DEFAULT 0,
  outstanding_debt BIGINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_tenant_id ON customers (tenant_id);

CREATE TABLE stock_movements (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id    UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  type         movement_type NOT NULL,
  stock_source stock_source NOT NULL DEFAULT 'verified',
  qty          INTEGER NOT NULL,
  qty_before   INTEGER NOT NULL,
  qty_after    INTEGER NOT NULL,
  reference    TEXT,
  notes        TEXT,
  user_id      UUID REFERENCES profiles (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_tenant_id ON stock_movements (tenant_id);
CREATE INDEX idx_stock_movements_branch_id ON stock_movements (branch_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements (tenant_id, created_at DESC);

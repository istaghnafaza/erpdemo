-- Phase 12 — Pricing tiers, margin floors, override audit

CREATE TABLE IF NOT EXISTS pricing_settings (
  tenant_id                    UUID PRIMARY KEY REFERENCES tenants (id) ON DELETE CASCADE,
  max_stack_discount_percent   INTEGER NOT NULL DEFAULT 12 CHECK (max_stack_discount_percent BETWEEN 0 AND 50),
  max_line_discount_percent    INTEGER NOT NULL DEFAULT 10 CHECK (max_line_discount_percent BETWEEN 0 AND 50),
  default_min_margin_percent   INTEGER NOT NULL DEFAULT 10 CHECK (default_min_margin_percent BETWEEN 0 AND 50),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                   UUID REFERENCES profiles (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS volume_price_tiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  tier_code       TEXT NOT NULL,
  name            TEXT NOT NULL,
  min_qty         INTEGER NOT NULL DEFAULT 0 CHECK (min_qty >= 0),
  min_line_amount BIGINT NOT NULL DEFAULT 0 CHECK (min_line_amount >= 0),
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 50),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, tier_code)
);

CREATE INDEX IF NOT EXISTS idx_volume_price_tiers_tenant ON volume_price_tiers (tenant_id);

CREATE TABLE IF NOT EXISTS customer_price_tiers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  tier_code           TEXT NOT NULL,
  name                TEXT NOT NULL,
  discount_percent    INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 50),
  min_transactions    INTEGER,
  min_rolling_omzet   BIGINT,
  rolling_days        INTEGER,
  description         TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, tier_code)
);

CREATE INDEX IF NOT EXISTS idx_customer_price_tiers_tenant ON customer_price_tiers (tenant_id);

CREATE TABLE IF NOT EXISTS category_margin_floors (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  category_id         UUID REFERENCES product_categories (id) ON DELETE CASCADE,
  min_margin_percent  INTEGER NOT NULL CHECK (min_margin_percent BETWEEN 0 AND 50),
  UNIQUE (tenant_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_category_margin_floors_tenant ON category_margin_floors (tenant_id);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS pricing_tier_id UUID REFERENCES customer_price_tiers (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS pricing_override_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id             UUID REFERENCES branches (id) ON DELETE SET NULL,
  sales_transaction_id  UUID REFERENCES sales_transactions (id) ON DELETE SET NULL,
  product_id            UUID REFERENCES products (id) ON DELETE SET NULL,
  sku                   TEXT NOT NULL,
  base_price            BIGINT NOT NULL,
  floor_price           BIGINT NOT NULL,
  override_price        BIGINT NOT NULL,
  reason                TEXT NOT NULL,
  created_by            UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_override_logs_tenant ON pricing_override_logs (tenant_id);

-- =============================================================================
-- SES — Neon Phase 3 Schema (POS sessions, carts, sales transactions)
-- Run AFTER phase2_schema.sql on existing Neon database.
-- =============================================================================

CREATE TYPE session_status AS ENUM ('open', 'closed');
CREATE TYPE cart_status AS ENUM ('active', 'hold', 'paid', 'cancelled');
CREATE TYPE payment_method AS ENUM (
  'cash', 'card', 'qris_edc', 'qris_gopay', 'qris_ovo', 'qris_other', 'transfer', 'credit'
);
CREATE TYPE tx_status AS ENUM ('completed', 'voided', 'returned');

CREATE TABLE cashier_sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id             UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  cashier_id            UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  status                session_status NOT NULL DEFAULT 'open',
  opened_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at             TIMESTAMPTZ,
  opening_cash_balance  BIGINT NOT NULL DEFAULT 0,
  expected_cash_balance BIGINT NOT NULL DEFAULT 0,
  actual_cash_balance   BIGINT,
  cash_discrepancy      BIGINT GENERATED ALWAYS AS (
                          COALESCE(actual_cash_balance, 0) - expected_cash_balance
                        ) STORED,
  total_sales           BIGINT NOT NULL DEFAULT 0,
  total_cash_sales      BIGINT NOT NULL DEFAULT 0,
  total_card_sales      BIGINT NOT NULL DEFAULT 0,
  total_transfer_sales  BIGINT NOT NULL DEFAULT 0,
  total_credit_sales    BIGINT NOT NULL DEFAULT 0,
  total_transactions    INTEGER NOT NULL DEFAULT 0,
  notes                 TEXT
);

CREATE INDEX idx_cashier_sessions_tenant_id  ON cashier_sessions (tenant_id);
CREATE INDEX idx_cashier_sessions_branch_id  ON cashier_sessions (branch_id);
CREATE INDEX idx_cashier_sessions_cashier_id ON cashier_sessions (cashier_id);
CREATE INDEX idx_cashier_sessions_opened_at  ON cashier_sessions (tenant_id, opened_at DESC);

CREATE TABLE pos_carts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  session_id       UUID NOT NULL REFERENCES cashier_sessions (id) ON DELETE CASCADE,
  cashier_id       UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  cart_number      SMALLINT NOT NULL CHECK (cart_number BETWEEN 1 AND 5),
  customer_name    TEXT,
  customer_id      UUID REFERENCES customers (id) ON DELETE SET NULL,
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  notes            TEXT,
  status           cart_status NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER pos_carts_updated_at
  BEFORE UPDATE ON pos_carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_pos_carts_tenant_id  ON pos_carts (tenant_id);
CREATE INDEX idx_pos_carts_branch_id  ON pos_carts (branch_id);
CREATE INDEX idx_pos_carts_session_id ON pos_carts (session_id);

CREATE TABLE sales_transactions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id              UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id              UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  session_id             UUID NOT NULL REFERENCES cashier_sessions (id) ON DELETE RESTRICT,
  cart_id                UUID REFERENCES pos_carts (id) ON DELETE SET NULL,
  transaction_number     TEXT NOT NULL,
  client_tx_id           TEXT,
  customer_id            UUID REFERENCES customers (id) ON DELETE SET NULL,
  customer_name          TEXT,
  subtotal               BIGINT NOT NULL DEFAULT 0,
  discount_amount        BIGINT NOT NULL DEFAULT 0,
  tax_amount             BIGINT NOT NULL DEFAULT 0,
  grand_total            BIGINT NOT NULL DEFAULT 0,
  payment_method         payment_method NOT NULL,
  qris_provider          VARCHAR(50),
  amount_paid            BIGINT NOT NULL DEFAULT 0,
  change_amount          BIGINT NOT NULL DEFAULT 0,
  input_by               UUID REFERENCES profiles (id) ON DELETE SET NULL,
  paid_by                UUID REFERENCES profiles (id) ON DELETE SET NULL,
  is_cross_session       BOOLEAN NOT NULL DEFAULT FALSE,
  has_legacy_items       BOOLEAN NOT NULL DEFAULT FALSE,
  is_offline_transaction BOOLEAN NOT NULL DEFAULT FALSE,
  offline_created_at     TIMESTAMPTZ,
  sync_status            TEXT NOT NULL DEFAULT 'synced',
  status                 tx_status NOT NULL DEFAULT 'completed',
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, transaction_number),
  UNIQUE (tenant_id, client_tx_id)
);

CREATE INDEX idx_sales_tx_tenant_id   ON sales_transactions (tenant_id);
CREATE INDEX idx_sales_tx_branch_id   ON sales_transactions (branch_id);
CREATE INDEX idx_sales_tx_session_id  ON sales_transactions (session_id);
CREATE INDEX idx_sales_tx_customer_id ON sales_transactions (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_sales_tx_created_at  ON sales_transactions (tenant_id, created_at DESC);
CREATE INDEX idx_sales_tx_tx_number   ON sales_transactions (tenant_id, transaction_number);
CREATE INDEX idx_sales_tx_client_tx   ON sales_transactions (tenant_id, client_tx_id) WHERE client_tx_id IS NOT NULL;

CREATE TABLE sales_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES sales_transactions (id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  product_id     UUID REFERENCES products (id) ON DELETE SET NULL,
  product_name   TEXT NOT NULL,
  sku            TEXT NOT NULL,
  unit           TEXT NOT NULL,
  qty            INTEGER NOT NULL CHECK (qty > 0),
  purchase_price BIGINT NOT NULL DEFAULT 0,
  selling_price  BIGINT NOT NULL DEFAULT 0,
  discount       BIGINT NOT NULL DEFAULT 0,
  subtotal       BIGINT NOT NULL DEFAULT 0,
  stock_source   stock_source NOT NULL DEFAULT 'verified'
);

CREATE INDEX idx_sales_items_tenant_id      ON sales_items (tenant_id);
CREATE INDEX idx_sales_items_transaction_id ON sales_items (transaction_id);
CREATE INDEX idx_sales_items_product_id     ON sales_items (product_id) WHERE product_id IS NOT NULL;

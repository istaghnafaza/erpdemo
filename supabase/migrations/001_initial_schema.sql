-- =============================================================================
-- SES (Simetri ERP Store) — Initial Schema Migration
-- Version: 001
-- Description: Full multi-tenant ERP schema for toko bangunan
-- Architecture: Shared DB, tenant-isolated via tenant_id on every table
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
CREATE TYPE tenant_plan          AS ENUM ('trial', 'basic', 'pro', 'enterprise');
CREATE TYPE user_role            AS ENUM ('owner', 'manager', 'cashier', 'warehouse', 'accountant');
CREATE TYPE session_status       AS ENUM ('open', 'closed');
CREATE TYPE cart_status          AS ENUM ('active', 'hold', 'paid', 'cancelled');
CREATE TYPE customer_type        AS ENUM ('retail', 'credit');
CREATE TYPE payment_method       AS ENUM ('cash', 'card', 'qris_edc', 'qris_gopay', 'qris_ovo', 'qris_other', 'transfer', 'credit');
CREATE TYPE tx_status            AS ENUM ('completed', 'voided', 'returned');
CREATE TYPE stock_source         AS ENUM ('verified', 'legacy', 'unverified');
CREATE TYPE movement_type        AS ENUM ('in', 'out', 'adjustment', 'opname', 'transfer_out', 'transfer_in', 'legacy_in', 'legacy_out');
CREATE TYPE transfer_status      AS ENUM ('draft', 'sent', 'received', 'cancelled');
CREATE TYPE po_type              AS ENUM ('regular', 'indent');
CREATE TYPE po_status            AS ENUM ('draft', 'sent', 'partial_received', 'received', 'cancelled');
CREATE TYPE so_status            AS ENUM ('draft', 'confirmed', 'partial_delivered', 'completed', 'cancelled');
CREATE TYPE so_payment_status    AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE so_item_status       AS ENUM ('pending', 'partial', 'fulfilled');
CREATE TYPE fulfillment_source   AS ENUM ('stock', 'indent');
CREATE TYPE fulfillment_status   AS ENUM ('planned', 'in_progress', 'delivered');
CREATE TYPE account_type         AS ENUM ('cash', 'bank');
CREATE TYPE cash_tx_type         AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE ar_status            AS ENUM ('unpaid', 'partial', 'paid', 'overdue');
CREATE TYPE ap_status            AS ENUM ('unpaid', 'partial', 'paid', 'overdue');
CREATE TYPE sync_status          AS ENUM ('pending', 'syncing', 'synced', 'failed');
CREATE TYPE reconcile_flag       AS ENUM ('STOCK_DEFICIT', 'CREDIT_EXCEEDED', 'PRICE_CHANGED');
CREATE TYPE ar_payment_method    AS ENUM ('cash', 'transfer');
CREATE TYPE offline_flag         AS ENUM ('STOCK_DEFICIT', 'CREDIT_EXCEEDED', 'PRICE_CHANGED');


-- ---------------------------------------------------------------------------
-- HELPER: updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- HELPER: get_current_tenant_id()
-- Reads tenant_id from the authenticated JWT claims (app_metadata).
-- Usage in RLS: tenant_id = get_current_tenant_id()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'tenant_id'),
      (auth.jwt() ->> 'tenant_id')
    )
  )::UUID;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ---------------------------------------------------------------------------
-- HELPER: is_super_admin()
-- Used to bypass tenant RLS for SES internal super admins.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::BOOLEAN,
    FALSE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- =============================================================================
-- TABLE 1: tenants
-- =============================================================================
CREATE TABLE tenants (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  owner_email          TEXT NOT NULL,
  phone                TEXT,
  plan                 tenant_plan NOT NULL DEFAULT 'trial',
  trial_ends_at        TIMESTAMPTZ,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  onboarding_complete  BOOLEAN NOT NULL DEFAULT FALSE,
  legacy_mode_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_tenants_slug ON tenants (slug);


-- =============================================================================
-- TABLE 2: branches
-- =============================================================================
CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  manager_id  UUID,                   -- FK to profiles (set after profiles table)
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX idx_branches_tenant_id ON branches (tenant_id);


-- =============================================================================
-- TABLE 3: profiles (extends auth.users — Supabase convention)
-- =============================================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'cashier',
  pin         VARCHAR(6),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_profiles_tenant_id ON profiles (tenant_id);
CREATE INDEX idx_profiles_email     ON profiles (tenant_id, email);

-- Back-fill FK: branches.manager_id -> profiles.id
ALTER TABLE branches
  ADD CONSTRAINT fk_branches_manager
  FOREIGN KEY (manager_id) REFERENCES profiles (id) ON DELETE SET NULL;


-- =============================================================================
-- TABLE 4: user_branches (many-to-many)
-- =============================================================================
CREATE TABLE user_branches (
  user_id    UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  branch_id  UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, branch_id)
);

CREATE INDEX idx_user_branches_tenant_id ON user_branches (tenant_id);
CREATE INDEX idx_user_branches_branch_id ON user_branches (branch_id);


-- =============================================================================
-- TABLE 5: product_categories
-- =============================================================================
CREATE TABLE product_categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_product_categories_tenant_id ON product_categories (tenant_id);


-- =============================================================================
-- TABLE 6: products (master produk, terpusat per tenant)
-- =============================================================================
CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  sku            TEXT NOT NULL,
  barcode        TEXT,
  name           TEXT NOT NULL,
  category_id    UUID REFERENCES product_categories (id) ON DELETE SET NULL,
  unit           TEXT NOT NULL DEFAULT 'pcs',
  purchase_price BIGINT NOT NULL DEFAULT 0,  -- stored in smallest currency unit (IDR cents = rupiah)
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sku)
);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_products_tenant_id   ON products (tenant_id);
CREATE INDEX idx_products_sku         ON products (tenant_id, sku);
CREATE INDEX idx_products_barcode     ON products (tenant_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_category_id ON products (tenant_id, category_id);


-- =============================================================================
-- TABLE 7: branch_products (stok & harga jual per cabang)
-- =============================================================================
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

CREATE INDEX idx_branch_products_tenant_id  ON branch_products (tenant_id);
CREATE INDEX idx_branch_products_branch_id  ON branch_products (branch_id);
CREATE INDEX idx_branch_products_product_id ON branch_products (product_id);


-- =============================================================================
-- TABLE 8: cashier_sessions
-- =============================================================================
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


-- =============================================================================
-- TABLE 10: customers (before pos_carts which references it)
-- =============================================================================
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
CREATE INDEX idx_customers_phone     ON customers (tenant_id, phone) WHERE phone IS NOT NULL;


-- =============================================================================
-- TABLE 9: pos_carts
-- =============================================================================
CREATE TABLE pos_carts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  session_id      UUID NOT NULL REFERENCES cashier_sessions (id) ON DELETE CASCADE,
  cashier_id      UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  cart_number     SMALLINT NOT NULL CHECK (cart_number BETWEEN 1 AND 5),
  customer_name   TEXT,
  customer_id     UUID REFERENCES customers (id) ON DELETE SET NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  status          cart_status NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER pos_carts_updated_at
  BEFORE UPDATE ON pos_carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_pos_carts_tenant_id  ON pos_carts (tenant_id);
CREATE INDEX idx_pos_carts_branch_id  ON pos_carts (branch_id);
CREATE INDEX idx_pos_carts_session_id ON pos_carts (session_id);


-- =============================================================================
-- TABLE 11: sales_transactions
-- =============================================================================
CREATE TABLE sales_transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id             UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  session_id            UUID NOT NULL REFERENCES cashier_sessions (id) ON DELETE RESTRICT,
  cart_id               UUID REFERENCES pos_carts (id) ON DELETE SET NULL,
  transaction_number    TEXT NOT NULL,
  customer_id           UUID REFERENCES customers (id) ON DELETE SET NULL,
  customer_name         TEXT,
  subtotal              BIGINT NOT NULL DEFAULT 0,
  discount_amount       BIGINT NOT NULL DEFAULT 0,
  tax_amount            BIGINT NOT NULL DEFAULT 0,
  grand_total           BIGINT NOT NULL DEFAULT 0,
  payment_method        payment_method NOT NULL,
  qris_provider         VARCHAR(50),
  amount_paid           BIGINT NOT NULL DEFAULT 0,
  change_amount         BIGINT NOT NULL DEFAULT 0,
  input_by              UUID REFERENCES profiles (id) ON DELETE SET NULL,
  paid_by               UUID REFERENCES profiles (id) ON DELETE SET NULL,
  is_cross_session      BOOLEAN NOT NULL DEFAULT FALSE,
  has_legacy_items      BOOLEAN NOT NULL DEFAULT FALSE,
  is_offline_transaction BOOLEAN NOT NULL DEFAULT FALSE,
  offline_created_at    TIMESTAMPTZ,
  sync_status           TEXT NOT NULL DEFAULT 'synced',
  status                tx_status NOT NULL DEFAULT 'completed',
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, transaction_number)
);

CREATE INDEX idx_sales_tx_tenant_id   ON sales_transactions (tenant_id);
CREATE INDEX idx_sales_tx_branch_id   ON sales_transactions (branch_id);
CREATE INDEX idx_sales_tx_session_id  ON sales_transactions (session_id);
CREATE INDEX idx_sales_tx_customer_id ON sales_transactions (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_sales_tx_created_at  ON sales_transactions (tenant_id, created_at DESC);
CREATE INDEX idx_sales_tx_tx_number   ON sales_transactions (tenant_id, transaction_number);


-- =============================================================================
-- TABLE 12: sales_items
-- =============================================================================
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


-- =============================================================================
-- TABLE 13: stock_movements
-- =============================================================================
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

CREATE INDEX idx_stock_movements_tenant_id  ON stock_movements (tenant_id);
CREATE INDEX idx_stock_movements_branch_id  ON stock_movements (branch_id);
CREATE INDEX idx_stock_movements_product_id ON stock_movements (product_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements (tenant_id, created_at DESC);


-- =============================================================================
-- TABLE 14: stock_transfers
-- =============================================================================
CREATE TABLE stock_transfers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  from_branch_id  UUID NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  to_branch_id    UUID NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  status          transfer_status NOT NULL DEFAULT 'draft',
  notes           TEXT,
  created_by      UUID REFERENCES profiles (id) ON DELETE SET NULL,
  confirmed_by    UUID REFERENCES profiles (id) ON DELETE SET NULL,
  sent_at         TIMESTAMPTZ,
  received_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, transfer_number)
);

CREATE INDEX idx_stock_transfers_tenant_id      ON stock_transfers (tenant_id);
CREATE INDEX idx_stock_transfers_from_branch_id ON stock_transfers (from_branch_id);
CREATE INDEX idx_stock_transfers_to_branch_id   ON stock_transfers (to_branch_id);
CREATE INDEX idx_stock_transfers_created_at     ON stock_transfers (tenant_id, created_at DESC);


-- =============================================================================
-- TABLE 15: stock_transfer_items
-- =============================================================================
CREATE TABLE stock_transfer_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id   UUID NOT NULL REFERENCES stock_transfers (id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  product_name  TEXT NOT NULL,
  sku           TEXT NOT NULL,
  unit          TEXT NOT NULL,
  requested_qty INTEGER NOT NULL DEFAULT 0,
  sent_qty      INTEGER NOT NULL DEFAULT 0,
  received_qty  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_stock_transfer_items_tenant_id   ON stock_transfer_items (tenant_id);
CREATE INDEX idx_stock_transfer_items_transfer_id ON stock_transfer_items (transfer_id);


-- =============================================================================
-- TABLE 16: suppliers
-- =============================================================================
CREATE TABLE suppliers (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  contact_person     TEXT,
  phone              TEXT,
  address            TEXT,
  email              TEXT,
  payment_term_days  INTEGER NOT NULL DEFAULT 30,
  outstanding_debt   BIGINT NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_suppliers_tenant_id ON suppliers (tenant_id);


-- =============================================================================
-- TABLE 21: sales_orders (before purchase_orders which may reference it)
-- =============================================================================
CREATE TABLE sales_orders (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id               UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  so_number               TEXT NOT NULL,
  customer_id             UUID REFERENCES customers (id) ON DELETE SET NULL,
  customer_name           TEXT NOT NULL,
  delivery_address        TEXT,
  subtotal                BIGINT NOT NULL DEFAULT 0,
  discount_amount         BIGINT NOT NULL DEFAULT 0,
  grand_total             BIGINT NOT NULL DEFAULT 0,
  down_payment            BIGINT NOT NULL DEFAULT 0,
  remaining_payment       BIGINT GENERATED ALWAYS AS (grand_total - down_payment) STORED,
  status                  so_status NOT NULL DEFAULT 'draft',
  payment_status          so_payment_status NOT NULL DEFAULT 'unpaid',
  estimated_delivery_date DATE,
  notes                   TEXT,
  created_by              UUID REFERENCES profiles (id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, so_number)
);

CREATE INDEX idx_sales_orders_tenant_id   ON sales_orders (tenant_id);
CREATE INDEX idx_sales_orders_branch_id   ON sales_orders (branch_id);
CREATE INDEX idx_sales_orders_customer_id ON sales_orders (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_sales_orders_created_at  ON sales_orders (tenant_id, created_at DESC);


-- =============================================================================
-- TABLE 17: purchase_orders
-- =============================================================================
CREATE TABLE purchase_orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  po_number        TEXT NOT NULL,
  type             po_type NOT NULL DEFAULT 'regular',
  sales_order_id   UUID REFERENCES sales_orders (id) ON DELETE SET NULL,
  supplier_id      UUID NOT NULL REFERENCES suppliers (id) ON DELETE RESTRICT,
  delivery_address TEXT,
  subtotal         BIGINT NOT NULL DEFAULT 0,
  grand_total      BIGINT NOT NULL DEFAULT 0,
  status           po_status NOT NULL DEFAULT 'draft',
  expected_date    DATE,
  notes            TEXT,
  created_by       UUID REFERENCES profiles (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, po_number)
);

CREATE INDEX idx_purchase_orders_tenant_id   ON purchase_orders (tenant_id);
CREATE INDEX idx_purchase_orders_branch_id   ON purchase_orders (branch_id);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders (supplier_id);
CREATE INDEX idx_purchase_orders_created_at  ON purchase_orders (tenant_id, created_at DESC);


-- =============================================================================
-- TABLE 18: purchase_order_items
-- =============================================================================
CREATE TABLE purchase_order_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id          UUID NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  product_id     UUID REFERENCES products (id) ON DELETE SET NULL,
  product_name   TEXT NOT NULL,
  sku            TEXT NOT NULL,
  unit           TEXT NOT NULL,
  ordered_qty    INTEGER NOT NULL DEFAULT 0,
  received_qty   INTEGER NOT NULL DEFAULT 0,
  purchase_price BIGINT NOT NULL DEFAULT 0,
  subtotal       BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_po_items_tenant_id  ON purchase_order_items (tenant_id);
CREATE INDEX idx_po_items_po_id      ON purchase_order_items (po_id);
CREATE INDEX idx_po_items_product_id ON purchase_order_items (product_id) WHERE product_id IS NOT NULL;


-- =============================================================================
-- TABLE 19: goods_receipts
-- =============================================================================
CREATE TABLE goods_receipts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id         UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  gr_number         TEXT NOT NULL,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders (id) ON DELETE RESTRICT,
  supplier_id       UUID NOT NULL REFERENCES suppliers (id) ON DELETE RESTRICT,
  received_by       UUID REFERENCES profiles (id) ON DELETE SET NULL,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes             TEXT,
  UNIQUE (tenant_id, gr_number)
);

CREATE INDEX idx_goods_receipts_tenant_id         ON goods_receipts (tenant_id);
CREATE INDEX idx_goods_receipts_branch_id         ON goods_receipts (branch_id);
CREATE INDEX idx_goods_receipts_purchase_order_id ON goods_receipts (purchase_order_id);
CREATE INDEX idx_goods_receipts_received_at       ON goods_receipts (tenant_id, received_at DESC);


-- =============================================================================
-- TABLE 20: goods_receipt_items
-- =============================================================================
CREATE TABLE goods_receipt_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gr_id        UUID NOT NULL REFERENCES goods_receipts (id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products (id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  ordered_qty  INTEGER NOT NULL DEFAULT 0,
  received_qty INTEGER NOT NULL DEFAULT 0,
  unit         TEXT NOT NULL
);

CREATE INDEX idx_gr_items_tenant_id  ON goods_receipt_items (tenant_id);
CREATE INDEX idx_gr_items_gr_id      ON goods_receipt_items (gr_id);
CREATE INDEX idx_gr_items_product_id ON goods_receipt_items (product_id) WHERE product_id IS NOT NULL;


-- =============================================================================
-- TABLE 22: sales_order_items
-- =============================================================================
CREATE TABLE sales_order_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id         UUID NOT NULL REFERENCES sales_orders (id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products (id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  sku           TEXT NOT NULL,
  unit          TEXT NOT NULL,
  qty           INTEGER NOT NULL CHECK (qty > 0),
  selling_price BIGINT NOT NULL DEFAULT 0,
  discount      BIGINT NOT NULL DEFAULT 0,
  subtotal      BIGINT NOT NULL DEFAULT 0,
  delivered_qty INTEGER NOT NULL DEFAULT 0,
  status        so_item_status NOT NULL DEFAULT 'pending'
);

CREATE INDEX idx_so_items_tenant_id  ON sales_order_items (tenant_id);
CREATE INDEX idx_so_items_so_id      ON sales_order_items (so_id);
CREATE INDEX idx_so_items_product_id ON sales_order_items (product_id) WHERE product_id IS NOT NULL;


-- =============================================================================
-- TABLE 23: so_fulfillments
-- =============================================================================
CREATE TABLE so_fulfillments (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_item_id             UUID NOT NULL REFERENCES sales_order_items (id) ON DELETE CASCADE,
  tenant_id              UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  source                 fulfillment_source NOT NULL,
  qty                    INTEGER NOT NULL CHECK (qty > 0),
  purchase_order_id      UUID REFERENCES purchase_orders (id) ON DELETE SET NULL,
  supplier_id            UUID REFERENCES suppliers (id) ON DELETE SET NULL,
  purchase_price_at_time BIGINT NOT NULL DEFAULT 0,
  status                 fulfillment_status NOT NULL DEFAULT 'planned'
);

CREATE INDEX idx_so_fulfillments_tenant_id         ON so_fulfillments (tenant_id);
CREATE INDEX idx_so_fulfillments_so_item_id        ON so_fulfillments (so_item_id);
CREATE INDEX idx_so_fulfillments_purchase_order_id ON so_fulfillments (purchase_order_id) WHERE purchase_order_id IS NOT NULL;


-- =============================================================================
-- TABLE 24: cash_accounts
-- =============================================================================
CREATE TABLE cash_accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id      UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  type           account_type NOT NULL DEFAULT 'cash',
  account_number TEXT,
  balance        BIGINT NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_cash_accounts_tenant_id ON cash_accounts (tenant_id);
CREATE INDEX idx_cash_accounts_branch_id ON cash_accounts (branch_id);


-- =============================================================================
-- TABLE 25: cash_transactions
-- =============================================================================
CREATE TABLE cash_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  cash_account_id UUID NOT NULL REFERENCES cash_accounts (id) ON DELETE RESTRICT,
  type            cash_tx_type NOT NULL,
  category        TEXT NOT NULL,
  amount          BIGINT NOT NULL,
  reference       TEXT,
  description     TEXT,
  user_id         UUID REFERENCES profiles (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_tx_tenant_id       ON cash_transactions (tenant_id);
CREATE INDEX idx_cash_tx_branch_id       ON cash_transactions (branch_id);
CREATE INDEX idx_cash_tx_cash_account_id ON cash_transactions (cash_account_id);
CREATE INDEX idx_cash_tx_created_at      ON cash_transactions (tenant_id, created_at DESC);


-- =============================================================================
-- TABLE 26: accounts_receivable
-- =============================================================================
CREATE TABLE accounts_receivable (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id            UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  invoice_number       TEXT NOT NULL,
  customer_id          UUID NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  customer_name        TEXT NOT NULL,
  sales_transaction_id UUID REFERENCES sales_transactions (id) ON DELETE SET NULL,
  sales_order_id       UUID REFERENCES sales_orders (id) ON DELETE SET NULL,
  total_amount         BIGINT NOT NULL DEFAULT 0,
  paid_amount          BIGINT NOT NULL DEFAULT 0,
  remaining_amount     BIGINT GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  due_date             DATE NOT NULL,
  status               ar_status NOT NULL DEFAULT 'unpaid',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX idx_ar_tenant_id    ON accounts_receivable (tenant_id);
CREATE INDEX idx_ar_branch_id    ON accounts_receivable (branch_id);
CREATE INDEX idx_ar_customer_id  ON accounts_receivable (customer_id);
CREATE INDEX idx_ar_due_date     ON accounts_receivable (tenant_id, due_date);
CREATE INDEX idx_ar_created_at   ON accounts_receivable (tenant_id, created_at DESC);


-- =============================================================================
-- TABLE 27: ar_payments
-- =============================================================================
CREATE TABLE ar_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ar_id           UUID NOT NULL REFERENCES accounts_receivable (id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  amount          BIGINT NOT NULL CHECK (amount > 0),
  payment_date    DATE NOT NULL,
  payment_method  ar_payment_method NOT NULL DEFAULT 'cash',
  notes           TEXT,
  user_id         UUID REFERENCES profiles (id) ON DELETE SET NULL
);

CREATE INDEX idx_ar_payments_tenant_id ON ar_payments (tenant_id);
CREATE INDEX idx_ar_payments_ar_id     ON ar_payments (ar_id);


-- =============================================================================
-- TABLE 28: accounts_payable
-- =============================================================================
CREATE TABLE accounts_payable (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id         UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  invoice_number    TEXT NOT NULL,
  supplier_id       UUID NOT NULL REFERENCES suppliers (id) ON DELETE RESTRICT,
  supplier_name     TEXT NOT NULL,
  purchase_order_id UUID REFERENCES purchase_orders (id) ON DELETE SET NULL,
  total_amount      BIGINT NOT NULL DEFAULT 0,
  paid_amount       BIGINT NOT NULL DEFAULT 0,
  remaining_amount  BIGINT GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  due_date          DATE NOT NULL,
  status            ap_status NOT NULL DEFAULT 'unpaid',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX idx_ap_tenant_id    ON accounts_payable (tenant_id);
CREATE INDEX idx_ap_branch_id    ON accounts_payable (branch_id);
CREATE INDEX idx_ap_supplier_id  ON accounts_payable (supplier_id);
CREATE INDEX idx_ap_due_date     ON accounts_payable (tenant_id, due_date);
CREATE INDEX idx_ap_created_at   ON accounts_payable (tenant_id, created_at DESC);


-- =============================================================================
-- TABLE 29: ap_payments
-- =============================================================================
CREATE TABLE ap_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ap_id           UUID NOT NULL REFERENCES accounts_payable (id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  amount          BIGINT NOT NULL CHECK (amount > 0),
  cash_account_id UUID REFERENCES cash_accounts (id) ON DELETE SET NULL,
  payment_date    DATE NOT NULL,
  notes           TEXT,
  user_id         UUID REFERENCES profiles (id) ON DELETE SET NULL
);

CREATE INDEX idx_ap_payments_tenant_id ON ap_payments (tenant_id);
CREATE INDEX idx_ap_payments_ap_id     ON ap_payments (ap_id);


-- =============================================================================
-- TABLE 30: offline_tx_queue
-- =============================================================================
CREATE TABLE offline_tx_queue (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id         TEXT NOT NULL UNIQUE,
  tenant_id        UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  session_id       UUID REFERENCES cashier_sessions (id) ON DELETE SET NULL,
  payload          JSONB NOT NULL,
  offline_created_at TIMESTAMPTZ NOT NULL,
  sync_status      sync_status NOT NULL DEFAULT 'pending',
  retry_count      INTEGER NOT NULL DEFAULT 0,
  last_retry_at    TIMESTAMPTZ,
  server_tx_id     UUID REFERENCES sales_transactions (id) ON DELETE SET NULL,
  flags            offline_flag[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_offline_queue_tenant_id   ON offline_tx_queue (tenant_id);
CREATE INDEX idx_offline_queue_branch_id   ON offline_tx_queue (branch_id);
CREATE INDEX idx_offline_queue_sync_status ON offline_tx_queue (tenant_id, sync_status);


-- =============================================================================
-- TABLE 31: reconciliation_alerts
-- =============================================================================
CREATE TABLE reconciliation_alerts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id      UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  triggered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_flagged  INTEGER NOT NULL DEFAULT 0,
  is_resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by    UUID REFERENCES profiles (id) ON DELETE SET NULL,
  resolved_at    TIMESTAMPTZ
);

CREATE INDEX idx_reconciliation_alerts_tenant_id    ON reconciliation_alerts (tenant_id);
CREATE INDEX idx_reconciliation_alerts_branch_id    ON reconciliation_alerts (branch_id);
CREATE INDEX idx_reconciliation_alerts_triggered_at ON reconciliation_alerts (tenant_id, triggered_at DESC);


-- =============================================================================
-- TABLE 32: reconciliation_alert_items
-- =============================================================================
CREATE TABLE reconciliation_alert_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id       UUID NOT NULL REFERENCES reconciliation_alerts (id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  server_tx_id   UUID REFERENCES sales_transactions (id) ON DELETE SET NULL,
  cashier_name   TEXT NOT NULL,
  flag           reconcile_flag NOT NULL,
  product_name   TEXT,
  customer_name  TEXT,
  detail         TEXT NOT NULL,
  action_taken   TEXT
);

CREATE INDEX idx_reconcile_items_tenant_id ON reconciliation_alert_items (tenant_id);
CREATE INDEX idx_reconcile_items_alert_id  ON reconciliation_alert_items (alert_id);


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Helper macro: enable RLS and add tenant isolation policy
-- Pattern: user sees only rows where tenant_id matches their JWT tenant_id,
--          OR user is super_admin (bypasses all tenant restrictions).

-- tenants: owner sees their own tenant; super_admin sees all
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenants_isolation ON tenants
  USING (
    is_super_admin()
    OR id = get_current_tenant_id()
  );

-- branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY branches_isolation ON branches
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_isolation ON profiles
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- user_branches
ALTER TABLE user_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_branches_isolation ON user_branches
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- product_categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_categories_isolation ON product_categories
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_isolation ON products
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- branch_products
ALTER TABLE branch_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_products_isolation ON branch_products
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- cashier_sessions
ALTER TABLE cashier_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cashier_sessions_isolation ON cashier_sessions
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- pos_carts
ALTER TABLE pos_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY pos_carts_isolation ON pos_carts
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_isolation ON customers
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- sales_transactions
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_transactions_isolation ON sales_transactions
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- sales_items
ALTER TABLE sales_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_items_isolation ON sales_items
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_movements_isolation ON stock_movements
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- stock_transfers
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_transfers_isolation ON stock_transfers
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- stock_transfer_items
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_transfer_items_isolation ON stock_transfer_items
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppliers_isolation ON suppliers
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- purchase_orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_orders_isolation ON purchase_orders
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- purchase_order_items
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_order_items_isolation ON purchase_order_items
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- goods_receipts
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY goods_receipts_isolation ON goods_receipts
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- goods_receipt_items
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY goods_receipt_items_isolation ON goods_receipt_items
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- sales_orders
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_orders_isolation ON sales_orders
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- sales_order_items
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_order_items_isolation ON sales_order_items
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- so_fulfillments
ALTER TABLE so_fulfillments ENABLE ROW LEVEL SECURITY;
CREATE POLICY so_fulfillments_isolation ON so_fulfillments
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- cash_accounts
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_accounts_isolation ON cash_accounts
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- cash_transactions
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_transactions_isolation ON cash_transactions
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- accounts_receivable
ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_receivable_isolation ON accounts_receivable
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ar_payments
ALTER TABLE ar_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ar_payments_isolation ON ar_payments
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- accounts_payable
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_payable_isolation ON accounts_payable
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ap_payments
ALTER TABLE ap_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ap_payments_isolation ON ap_payments
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- offline_tx_queue
ALTER TABLE offline_tx_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY offline_tx_queue_isolation ON offline_tx_queue
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- reconciliation_alerts
ALTER TABLE reconciliation_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY reconciliation_alerts_isolation ON reconciliation_alerts
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- reconciliation_alert_items
ALTER TABLE reconciliation_alert_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY reconciliation_alert_items_isolation ON reconciliation_alert_items
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());


-- =============================================================================
-- SEED: Supabase service role bypass
-- Service role key bypasses RLS automatically — no additional policy needed.
-- All policies above use FOR ALL (SELECT + INSERT + UPDATE + DELETE).
-- =============================================================================

-- =============================================================================
-- END OF MIGRATION 001
-- =============================================================================

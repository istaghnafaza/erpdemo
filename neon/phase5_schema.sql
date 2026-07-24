-- =============================================================================
-- SES — Neon Phase 5 Schema (transfers, PO/GRN, sales orders, report views)
-- Run AFTER phase4_schema.sql
-- =============================================================================

CREATE TYPE transfer_status AS ENUM ('draft', 'sent', 'received', 'cancelled');
CREATE TYPE po_type AS ENUM ('regular', 'indent');
CREATE TYPE po_status AS ENUM ('draft', 'sent', 'partial_received', 'received', 'cancelled');
CREATE TYPE so_status AS ENUM ('draft', 'confirmed', 'partial_delivered', 'completed', 'cancelled');
CREATE TYPE so_payment_status AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE so_item_status AS ENUM ('pending', 'partial', 'fulfilled');
CREATE TYPE fulfillment_source AS ENUM ('stock', 'indent');
CREATE TYPE fulfillment_status AS ENUM ('planned', 'in_progress', 'delivered');

-- Sales orders (before PO — FK reference)
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

CREATE INDEX idx_sales_orders_tenant_id ON sales_orders (tenant_id);
CREATE INDEX idx_sales_orders_branch_id ON sales_orders (branch_id);
CREATE INDEX idx_sales_orders_created_at ON sales_orders (tenant_id, created_at DESC);

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

CREATE INDEX idx_so_items_tenant_id ON sales_order_items (tenant_id);
CREATE INDEX idx_so_items_so_id ON sales_order_items (so_id);

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

CREATE INDEX idx_purchase_orders_tenant_id ON purchase_orders (tenant_id);
CREATE INDEX idx_purchase_orders_branch_id ON purchase_orders (branch_id);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders (supplier_id);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders (tenant_id, created_at DESC);

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

CREATE INDEX idx_po_items_tenant_id ON purchase_order_items (tenant_id);
CREATE INDEX idx_po_items_po_id ON purchase_order_items (po_id);

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

CREATE INDEX idx_goods_receipts_tenant_id ON goods_receipts (tenant_id);
CREATE INDEX idx_goods_receipts_branch_id ON goods_receipts (branch_id);
CREATE INDEX idx_goods_receipts_po_id ON goods_receipts (purchase_order_id);

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

CREATE INDEX idx_gr_items_tenant_id ON goods_receipt_items (tenant_id);
CREATE INDEX idx_gr_items_gr_id ON goods_receipt_items (gr_id);

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

CREATE INDEX idx_so_fulfillments_tenant_id ON so_fulfillments (tenant_id);
CREATE INDEX idx_so_fulfillments_so_item_id ON so_fulfillments (so_item_id);

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

CREATE INDEX idx_stock_transfers_tenant_id ON stock_transfers (tenant_id);
CREATE INDEX idx_stock_transfers_from_branch ON stock_transfers (from_branch_id);
CREATE INDEX idx_stock_transfers_to_branch ON stock_transfers (to_branch_id);

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

CREATE INDEX idx_stock_transfer_items_tenant_id ON stock_transfer_items (tenant_id);
CREATE INDEX idx_stock_transfer_items_transfer_id ON stock_transfer_items (transfer_id);

-- Link finance tables created in phase 4
ALTER TABLE accounts_receivable
  ADD CONSTRAINT fk_ar_sales_order
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders (id) ON DELETE SET NULL;

ALTER TABLE accounts_payable
  ADD CONSTRAINT fk_ap_purchase_order
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE SET NULL;

CREATE VIEW v_daily_sales AS
SELECT
  tenant_id,
  branch_id,
  DATE(created_at) AS sale_date,
  COUNT(*) AS tx_count,
  SUM(grand_total) AS revenue
FROM sales_transactions
WHERE status = 'completed'
GROUP BY tenant_id, branch_id, DATE(created_at);

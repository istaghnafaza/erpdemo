-- Phase 8 — Fase C scaling (50–200 tenants)
-- daily aggregates, deliveries, online orders, audit log, report indexes

-- ---------------------------------------------------------------------------
-- P2-2: Daily branch sales aggregates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_branch_sales (
  tenant_id    UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id    UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  sale_date    DATE NOT NULL,
  tx_count     INTEGER NOT NULL DEFAULT 0,
  total_revenue BIGINT NOT NULL DEFAULT 0,
  cash_revenue BIGINT NOT NULL DEFAULT 0,
  transfer_revenue BIGINT NOT NULL DEFAULT 0,
  qris_revenue BIGINT NOT NULL DEFAULT 0,
  credit_revenue BIGINT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, branch_id, sale_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_branch_sales_tenant_date
  ON daily_branch_sales (tenant_id, sale_date);

-- ---------------------------------------------------------------------------
-- Report query index (tenant + branch + status + date)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sales_tx_tenant_branch_status_created
  ON sales_transactions (tenant_id, branch_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- P1-5 Neon: deliveries (sidebar badge + future module)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM (
    'pending', 'preparing', 'in_transit', 'delivered', 'partial_delivered', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS deliveries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id             UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  sales_transaction_id  UUID REFERENCES sales_transactions (id) ON DELETE SET NULL,
  delivery_number       TEXT NOT NULL,
  customer_name         TEXT,
  delivery_address      TEXT,
  status                delivery_status NOT NULL DEFAULT 'pending',
  grand_total           BIGINT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, delivery_number)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_tenant_branch_status
  ON deliveries (tenant_id, branch_id, status);

-- ---------------------------------------------------------------------------
-- P1-5 Neon: online orders (customer portal)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE online_order_status AS ENUM (
    'pending_approval', 'approved', 'payment_uploaded', 'processing',
    'shipped', 'completed', 'cancelled', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS online_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  order_number    TEXT NOT NULL,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT,
  status          online_order_status NOT NULL DEFAULT 'pending_approval',
  grand_total     BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_online_orders_tenant_branch_status
  ON online_orders (tenant_id, branch_id, status);

-- ---------------------------------------------------------------------------
-- P2-4: Audit events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES profiles (id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  metadata     JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_created
  ON audit_events (tenant_id, created_at DESC);

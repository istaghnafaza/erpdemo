-- Phase 17: plan billing — Midtrans Snap subscriptions + invoices

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_renews_at timestamptz;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE plan_invoice_status AS ENUM ('pending', 'paid', 'failed', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan tenant_plan NOT NULL,
  status subscription_status NOT NULL DEFAULT 'trialing',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  current_period_start timestamptz,
  current_period_end timestamptz,
  midtrans_order_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status
  ON tenant_subscriptions (status);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_period_end
  ON tenant_subscriptions (current_period_end)
  WHERE status IN ('active', 'past_due', 'trialing');

CREATE TABLE IF NOT EXISTS plan_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  plan tenant_plan NOT NULL,
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  status plan_invoice_status NOT NULL DEFAULT 'pending',
  midtrans_order_id text NOT NULL,
  paid_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (midtrans_order_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_invoices_tenant
  ON plan_invoices (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plan_invoices_status
  ON plan_invoices (status)
  WHERE status IN ('pending', 'failed', 'expired');

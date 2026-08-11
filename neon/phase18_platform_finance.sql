-- Phase 18: platform finance — HPP bulanan + remote plan pricing (developer)

CREATE TABLE IF NOT EXISTS platform_finance_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  monthly_hpp bigint NOT NULL DEFAULT 0,
  target_margin_pct integer NOT NULL DEFAULT 40,
  expected_paying_tenants integer NOT NULL DEFAULT 10,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO platform_finance_settings (id, monthly_hpp, target_margin_pct, expected_paying_tenants)
VALUES (1, 0, 40, 10)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS platform_hpp_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month text NOT NULL,
  amount bigint NOT NULL CHECK (amount >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year_month)
);

CREATE INDEX IF NOT EXISTS idx_platform_hpp_entries_ym
  ON platform_hpp_entries (year_month DESC);

CREATE TABLE IF NOT EXISTS platform_plan_pricing (
  plan text PRIMARY KEY CHECK (plan IN ('basic', 'pro', 'enterprise')),
  monthly_amount bigint NOT NULL CHECK (monthly_amount >= 0),
  yearly_amount bigint NOT NULL CHECK (yearly_amount >= 0),
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO platform_plan_pricing (plan, monthly_amount, yearly_amount)
VALUES
  ('basic', 599000, 499000),
  ('pro', 849000, 749000),
  ('enterprise', 2499000, 1999000)
ON CONFLICT (plan) DO NOTHING;

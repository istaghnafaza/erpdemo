-- Phase 19: HPP as expense line items (list pengeluaran per bulan)

CREATE TABLE IF NOT EXISTS platform_hpp_expense_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month text NOT NULL,
  label text NOT NULL,
  amount bigint NOT NULL CHECK (amount >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_hpp_expense_ym
  ON platform_hpp_expense_items (year_month, sort_order);

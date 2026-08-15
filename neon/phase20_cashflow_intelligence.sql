-- Cashflow Intelligence — default accounts, paired transfers, SO P&L date, owner capital

DO $$ BEGIN
  CREATE TYPE owner_capital_kind AS ENUM ('prive_keluar', 'setoran_owner');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE cash_accounts
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS counterpart_account_id UUID REFERENCES cash_accounts(id) ON DELETE SET NULL;

ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS pair_id UUID;

ALTER TABLE so_fulfillments
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS owner_capital_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  cash_account_id UUID NOT NULL REFERENCES cash_accounts(id) ON DELETE RESTRICT,
  kind owner_capital_kind NOT NULL,
  amount BIGINT NOT NULL,
  occurred_at DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cash_accounts_one_default_per_type
  ON cash_accounts (tenant_id, branch_id, type)
  WHERE is_default = true AND is_active = true;

CREATE INDEX IF NOT EXISTS cash_transactions_pair_id_idx
  ON cash_transactions (pair_id)
  WHERE pair_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS owner_capital_tenant_branch_idx
  ON owner_capital_transactions (tenant_id, branch_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS so_fulfillments_created_at_idx
  ON so_fulfillments (tenant_id, created_at);

-- Seed one default cash + bank per branch when none marked yet
UPDATE cash_accounts ca
SET is_default = true
WHERE ca.is_active = true
  AND ca.id = (
    SELECT x.id
    FROM cash_accounts x
    WHERE x.tenant_id = ca.tenant_id
      AND x.branch_id = ca.branch_id
      AND x.type = ca.type
      AND x.is_active = true
    ORDER BY x.name
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM cash_accounts d
    WHERE d.tenant_id = ca.tenant_id
      AND d.branch_id = ca.branch_id
      AND d.type = ca.type
      AND d.is_default = true
  );

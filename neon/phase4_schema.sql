-- =============================================================================
-- SES — Neon Phase 4 Schema (finance, AR, AP)
-- Run AFTER phase3_schema.sql
-- =============================================================================

CREATE TYPE account_type AS ENUM ('cash', 'bank');
CREATE TYPE cash_tx_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE ar_status AS ENUM ('unpaid', 'partial', 'paid', 'overdue');
CREATE TYPE ap_status AS ENUM ('unpaid', 'partial', 'paid', 'overdue');
CREATE TYPE ar_payment_method AS ENUM ('cash', 'transfer');

CREATE TABLE suppliers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  contact_person    TEXT,
  phone             TEXT,
  address           TEXT,
  email             TEXT,
  payment_term_days INTEGER NOT NULL DEFAULT 30,
  outstanding_debt  BIGINT NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_suppliers_tenant_id ON suppliers (tenant_id);

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

CREATE TABLE accounts_receivable (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id            UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  invoice_number       TEXT NOT NULL,
  customer_id          UUID NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  customer_name        TEXT NOT NULL,
  sales_transaction_id UUID REFERENCES sales_transactions (id) ON DELETE SET NULL,
  sales_order_id       UUID,
  total_amount         BIGINT NOT NULL DEFAULT 0,
  paid_amount          BIGINT NOT NULL DEFAULT 0,
  remaining_amount     BIGINT GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  due_date             DATE NOT NULL,
  status               ar_status NOT NULL DEFAULT 'unpaid',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX idx_ar_tenant_id   ON accounts_receivable (tenant_id);
CREATE INDEX idx_ar_branch_id   ON accounts_receivable (branch_id);
CREATE INDEX idx_ar_customer_id ON accounts_receivable (customer_id);
CREATE INDEX idx_ar_due_date    ON accounts_receivable (tenant_id, due_date);

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

CREATE TABLE accounts_payable (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  branch_id         UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  invoice_number    TEXT NOT NULL,
  supplier_id       UUID NOT NULL REFERENCES suppliers (id) ON DELETE RESTRICT,
  supplier_name     TEXT NOT NULL,
  purchase_order_id UUID,
  total_amount      BIGINT NOT NULL DEFAULT 0,
  paid_amount       BIGINT NOT NULL DEFAULT 0,
  remaining_amount  BIGINT GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  due_date          DATE NOT NULL,
  status            ap_status NOT NULL DEFAULT 'unpaid',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX idx_ap_tenant_id   ON accounts_payable (tenant_id);
CREATE INDEX idx_ap_branch_id   ON accounts_payable (branch_id);
CREATE INDEX idx_ap_supplier_id ON accounts_payable (supplier_id);
CREATE INDEX idx_ap_due_date    ON accounts_payable (tenant_id, due_date);

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

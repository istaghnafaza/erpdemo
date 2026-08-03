-- Phase 14 — Retur penjualan (QC, refund tunai/transfer, offset transaksi baru)

DO $$ BEGIN
  CREATE TYPE sales_return_status AS ENUM (
    'pending_qc',
    'qc_completed',
    'pending_approval',
    'pending_offset',
    'completed',
    'rejected',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sales_return_settlement AS ENUM ('standalone_refund', 'offset_in_new_sale');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sales_return_refund_method AS ENUM ('cash', 'transfer', 'credit_adjust');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS return_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  refund_window_days INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS return_block_label TEXT;

ALTER TABLE sales_items ADD COLUMN IF NOT EXISTS qty_returned INT NOT NULL DEFAULT 0;

ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS return_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS return_offset_amount BIGINT NOT NULL DEFAULT 0;
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS linked_return_id UUID;

CREATE TABLE IF NOT EXISTS sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  return_number TEXT NOT NULL,
  original_transaction_id UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE RESTRICT,
  original_transaction_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  status sales_return_status NOT NULL DEFAULT 'pending_qc',
  settlement sales_return_settlement,
  is_late_return BOOLEAN NOT NULL DEFAULT false,
  refund_method sales_return_refund_method,
  requested_refund_amount BIGINT NOT NULL DEFAULT 0,
  approved_refund_amount BIGINT NOT NULL DEFAULT 0,
  offset_transaction_id UUID REFERENCES sales_transactions(id) ON DELETE SET NULL,
  reason_notes TEXT,
  requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  qc_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  qc_at TIMESTAMPTZ,
  qc_notes TEXT,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, return_number)
);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_sales_item_id UUID NOT NULL REFERENCES sales_items(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty_sold INT NOT NULL,
  qty_requested INT NOT NULL,
  qty_qc_passed INT NOT NULL DEFAULT 0,
  unit_refund_price BIGINT NOT NULL DEFAULT 0,
  refund_subtotal BIGINT NOT NULL DEFAULT 0,
  qc_passed BOOLEAN,
  qc_reject_reason TEXT,
  stock_source stock_source NOT NULL DEFAULT 'verified',
  is_non_returnable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_returns_tenant_status ON sales_returns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_returns_original_tx ON sales_returns(original_transaction_id);

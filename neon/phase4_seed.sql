-- =============================================================================
-- SES — Neon Phase 4 Seed (suppliers, cash accounts, AR, AP)
-- Run AFTER phase4_schema.sql
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _ids (key TEXT PRIMARY KEY, val UUID);

INSERT INTO _ids VALUES
  ('tenant',       '11111111-0000-0000-0000-000000000001'),
  ('br_sudirman',  '22221111-0000-0000-0000-000000000001'),
  ('cust_abadi',   '66661111-0000-0000-0000-000000000001'),
  ('cust_budi',    '66661111-0000-0000-0000-000000000002'),
  ('sup_semen',    '77771111-0000-0000-0000-000000000001'),
  ('sup_besi',     '77771111-0000-0000-0000-000000000002'),
  ('ca_kas',       '88881111-0000-0000-0000-000000000001'),
  ('ca_bca',       '88881111-0000-0000-0000-000000000002'),
  ('ca_bri',       '88881111-0000-0000-0000-000000000003');

INSERT INTO suppliers (id, tenant_id, name, contact_person, phone, payment_term_days, outstanding_debt, is_active)
VALUES
  (
    (SELECT val FROM _ids WHERE key='sup_semen'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'PT Sumber Semen Indonesia', 'Pak Hari', '081234567890', 30, 25000000, TRUE
  ),
  (
    (SELECT val FROM _ids WHERE key='sup_besi'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'Toko Besi Makmur', 'Bu Ani', '081298765432', 14, 8500000, TRUE
  )
ON CONFLICT DO NOTHING;

INSERT INTO cash_accounts (id, tenant_id, branch_id, name, type, account_number, balance, is_active)
VALUES
  (
    (SELECT val FROM _ids WHERE key='ca_kas'),
    (SELECT val FROM _ids WHERE key='tenant'),
    (SELECT val FROM _ids WHERE key='br_sudirman'),
    'Kas Tunai Sudirman', 'cash', NULL, 8500000, TRUE
  ),
  (
    (SELECT val FROM _ids WHERE key='ca_bca'),
    (SELECT val FROM _ids WHERE key='tenant'),
    (SELECT val FROM _ids WHERE key='br_sudirman'),
    'Rekening BCA', 'bank', '1234567890', 45200000, TRUE
  ),
  (
    (SELECT val FROM _ids WHERE key='ca_bri'),
    (SELECT val FROM _ids WHERE key='tenant'),
    (SELECT val FROM _ids WHERE key='br_sudirman'),
    'Rekening BRI', 'bank', '0987654321', 23100000, TRUE
  )
ON CONFLICT DO NOTHING;

INSERT INTO accounts_receivable
  (tenant_id, branch_id, invoice_number, customer_id, customer_name, total_amount, paid_amount, due_date, status)
VALUES
  (
    (SELECT val FROM _ids WHERE key='tenant'),
    (SELECT val FROM _ids WHERE key='br_sudirman'),
    'INV-AR-2025-01-001',
    (SELECT val FROM _ids WHERE key='cust_abadi'),
    'PT Abadi Jaya Konstruksi',
    12000000, 0,
    CURRENT_DATE - INTERVAL '10 days',
    'overdue'
  ),
  (
    (SELECT val FROM _ids WHERE key='tenant'),
    (SELECT val FROM _ids WHERE key='br_sudirman'),
    'INV-AR-2025-01-002',
    (SELECT val FROM _ids WHERE key='cust_budi'),
    'Toko Pak Budi',
    5500000, 0,
    CURRENT_DATE + INTERVAL '3 days',
    'unpaid'
  )
ON CONFLICT DO NOTHING;

INSERT INTO accounts_payable
  (tenant_id, branch_id, invoice_number, supplier_id, supplier_name, total_amount, paid_amount, due_date, status)
VALUES
  (
    (SELECT val FROM _ids WHERE key='tenant'),
    (SELECT val FROM _ids WHERE key='br_sudirman'),
    'INV-AP-2025-01-001',
    (SELECT val FROM _ids WHERE key='sup_semen'),
    'PT Sumber Semen Indonesia',
    25000000, 0,
    CURRENT_DATE + INTERVAL '7 days',
    'unpaid'
  ),
  (
    (SELECT val FROM _ids WHERE key='tenant'),
    (SELECT val FROM _ids WHERE key='br_sudirman'),
    'INV-AP-2025-01-002',
    (SELECT val FROM _ids WHERE key='sup_besi'),
    'Toko Besi Makmur',
    8500000, 0,
    CURRENT_DATE + INTERVAL '2 days',
    'unpaid'
  )
ON CONFLICT DO NOTHING;

COMMIT;

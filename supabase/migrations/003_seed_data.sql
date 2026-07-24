-- =============================================================================
-- SES (Simetri ERP Store) — Development Seed Data
-- Version: 003
-- Description: Demo data for development & QA — NOT for production.
-- Run AFTER: 001_initial_schema.sql, 002_rls_policies.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- VARIABLES (via temp table so UUIDs are reusable across statements)
-- =============================================================================
CREATE TEMP TABLE _ids (key TEXT PRIMARY KEY, val UUID);

INSERT INTO _ids VALUES
  -- tenant
  ('tenant',         '11111111-0000-0000-0000-000000000001'),
  -- branches
  ('br_sudirman',    '22221111-0000-0000-0000-000000000001'),
  ('br_kebonjeruk',  '22221111-0000-0000-0000-000000000002'),
  ('br_bekasi',      '22221111-0000-0000-0000-000000000003'),
  -- profiles / users
  ('u_budi',         '33331111-0000-0000-0000-000000000001'),  -- owner
  ('u_siti',         '33331111-0000-0000-0000-000000000002'),  -- manager
  ('u_rudi',         '33331111-0000-0000-0000-000000000003'),  -- manager
  ('u_andi',         '33331111-0000-0000-0000-000000000004'),  -- cashier
  ('u_dewi',         '33331111-0000-0000-0000-000000000005'),  -- warehouse
  -- product categories
  ('cat_semen',      '44441111-0000-0000-0000-000000000001'),
  ('cat_bata',       '44441111-0000-0000-0000-000000000002'),
  ('cat_cat',        '44441111-0000-0000-0000-000000000003'),
  ('cat_pipa',       '44441111-0000-0000-0000-000000000004'),
  ('cat_besi',       '44441111-0000-0000-0000-000000000005'),
  ('cat_keramik',    '44441111-0000-0000-0000-000000000006'),
  -- products
  ('p_001', '55551111-0000-0000-0000-000000000001'),
  ('p_002', '55551111-0000-0000-0000-000000000002'),
  ('p_003', '55551111-0000-0000-0000-000000000003'),
  ('p_004', '55551111-0000-0000-0000-000000000004'),
  ('p_005', '55551111-0000-0000-0000-000000000005'),
  ('p_006', '55551111-0000-0000-0000-000000000006'),
  ('p_007', '55551111-0000-0000-0000-000000000007'),
  ('p_008', '55551111-0000-0000-0000-000000000008'),
  ('p_009', '55551111-0000-0000-0000-000000000009'),
  ('p_010', '55551111-0000-0000-0000-000000000010'),
  ('p_011', '55551111-0000-0000-0000-000000000011'),
  ('p_012', '55551111-0000-0000-0000-000000000012'),
  -- customers
  ('cust_abadi',     '66661111-0000-0000-0000-000000000001'),
  ('cust_budi',      '66661111-0000-0000-0000-000000000002'),
  ('cust_umum',      '66661111-0000-0000-0000-000000000003'),
  -- suppliers
  ('sup_semen',      '77771111-0000-0000-0000-000000000001'),
  ('sup_besi',       '77771111-0000-0000-0000-000000000002'),
  -- cash accounts
  ('ca_kas',         '88881111-0000-0000-0000-000000000001'),
  ('ca_bca',         '88881111-0000-0000-0000-000000000002'),
  ('ca_bri',         '88881111-0000-0000-0000-000000000003');


-- =============================================================================
-- 1. TENANT
-- =============================================================================
INSERT INTO tenants (id, name, slug, owner_email, phone, plan,
                     is_active, onboarding_complete, legacy_mode_active)
VALUES (
  (SELECT val FROM _ids WHERE key='tenant'),
  'Toko Bangunan Simetri',
  'toko-simetri',
  'budi@simetri.id',
  '021-5551234',
  'pro',
  TRUE, TRUE, FALSE
);


-- =============================================================================
-- 2. BRANCHES
-- =============================================================================
INSERT INTO branches (id, tenant_id, code, name, address, phone, is_active)
VALUES
  (
    (SELECT val FROM _ids WHERE key='br_sudirman'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'SDR', 'Cabang Sudirman',
    'Jl. Jend. Sudirman No. 45, Jakarta Pusat',
    '021-5551234', TRUE
  ),
  (
    (SELECT val FROM _ids WHERE key='br_kebonjeruk'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'KBJ', 'Cabang Kebon Jeruk',
    'Jl. Kebon Jeruk No. 12, Jakarta Barat',
    '021-5556789', TRUE
  ),
  (
    (SELECT val FROM _ids WHERE key='br_bekasi'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'BKS', 'Cabang Bekasi',
    'Jl. Ahmad Yani No. 88, Bekasi',
    '021-5559012', TRUE
  );


-- =============================================================================
-- 3a. AUTH.USERS (seed demo users directly into Supabase Auth)
--     Password untuk semua user demo: "DemoSES2025!"
--     tenant_id disimpan di app_metadata sehingga JWT claims terisi otomatis.
-- =============================================================================
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at, updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  uid, 'authenticated', 'authenticated', eml,
  crypt('DemoSES2025!', gen_salt('bf')),
  NOW(),
  jsonb_build_object(
    'provider', 'email',
    'providers', ARRAY['email'],
    'tenant_id', (SELECT val FROM _ids WHERE key='tenant')::TEXT,
    'is_super_admin', FALSE
  ),
  '{}',
  NOW(), NOW()
FROM (VALUES
  ((SELECT val FROM _ids WHERE key='u_budi'),  'budi@simetri.id'),
  ((SELECT val FROM _ids WHERE key='u_siti'),  'siti@simetri.id'),
  ((SELECT val FROM _ids WHERE key='u_rudi'),  'rudi@simetri.id'),
  ((SELECT val FROM _ids WHERE key='u_andi'),  'andi@simetri.id'),
  ((SELECT val FROM _ids WHERE key='u_dewi'),  'dewi@simetri.id')
) AS t(uid, eml)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(), uid, eml,
  jsonb_build_object('sub', uid::TEXT, 'email', eml),
  'email', NOW(), NOW(), NOW()
FROM (VALUES
  ((SELECT val FROM _ids WHERE key='u_budi'),  'budi@simetri.id'),
  ((SELECT val FROM _ids WHERE key='u_siti'),  'siti@simetri.id'),
  ((SELECT val FROM _ids WHERE key='u_rudi'),  'rudi@simetri.id'),
  ((SELECT val FROM _ids WHERE key='u_andi'),  'andi@simetri.id'),
  ((SELECT val FROM _ids WHERE key='u_dewi'),  'dewi@simetri.id')
) AS t(uid, eml)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 3b. PROFILES
-- =============================================================================
INSERT INTO profiles (id, tenant_id, name, email, role, pin, is_active)
VALUES
  (
    (SELECT val FROM _ids WHERE key='u_budi'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'Budi Santoso', 'budi@simetri.id', 'owner', '000000', TRUE
  ),
  (
    (SELECT val FROM _ids WHERE key='u_siti'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'Siti Rahma', 'siti@simetri.id', 'manager', '111111', TRUE
  ),
  (
    (SELECT val FROM _ids WHERE key='u_rudi'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'Rudi Hermawan', 'rudi@simetri.id', 'manager', '555555', TRUE
  ),
  (
    (SELECT val FROM _ids WHERE key='u_andi'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'Andi Pratama', 'andi@simetri.id', 'cashier', '222222', TRUE
  ),
  (
    (SELECT val FROM _ids WHERE key='u_dewi'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'Dewi Lestari', 'dewi@simetri.id', 'warehouse', '333333', TRUE
  );

-- Update branch managers
UPDATE branches SET manager_id = (SELECT val FROM _ids WHERE key='u_siti')
  WHERE id = (SELECT val FROM _ids WHERE key='br_sudirman');
UPDATE branches SET manager_id = (SELECT val FROM _ids WHERE key='u_rudi')
  WHERE id = (SELECT val FROM _ids WHERE key='br_bekasi');


-- =============================================================================
-- 4. USER_BRANCHES (access assignments)
-- =============================================================================
INSERT INTO user_branches (user_id, branch_id, tenant_id)
SELECT u, b, (SELECT val FROM _ids WHERE key='tenant')
FROM (VALUES
  -- Budi (owner) → semua cabang
  ((SELECT val FROM _ids WHERE key='u_budi'), (SELECT val FROM _ids WHERE key='br_sudirman')),
  ((SELECT val FROM _ids WHERE key='u_budi'), (SELECT val FROM _ids WHERE key='br_kebonjeruk')),
  ((SELECT val FROM _ids WHERE key='u_budi'), (SELECT val FROM _ids WHERE key='br_bekasi')),
  -- Siti (manager) → Sudirman + Kebon Jeruk
  ((SELECT val FROM _ids WHERE key='u_siti'), (SELECT val FROM _ids WHERE key='br_sudirman')),
  ((SELECT val FROM _ids WHERE key='u_siti'), (SELECT val FROM _ids WHERE key='br_kebonjeruk')),
  -- Rudi (manager) → Kebon Jeruk + Bekasi
  ((SELECT val FROM _ids WHERE key='u_rudi'), (SELECT val FROM _ids WHERE key='br_kebonjeruk')),
  ((SELECT val FROM _ids WHERE key='u_rudi'), (SELECT val FROM _ids WHERE key='br_bekasi')),
  -- Andi (cashier) → Sudirman only
  ((SELECT val FROM _ids WHERE key='u_andi'), (SELECT val FROM _ids WHERE key='br_sudirman')),
  -- Dewi (warehouse) → Sudirman only
  ((SELECT val FROM _ids WHERE key='u_dewi'), (SELECT val FROM _ids WHERE key='br_sudirman'))
) AS t(u, b);


-- =============================================================================
-- 5. PRODUCT CATEGORIES
-- =============================================================================
INSERT INTO product_categories (id, tenant_id, name, icon)
VALUES
  ((SELECT val FROM _ids WHERE key='cat_semen'),   (SELECT val FROM _ids WHERE key='tenant'), 'Semen',           '🏗️'),
  ((SELECT val FROM _ids WHERE key='cat_bata'),    (SELECT val FROM _ids WHERE key='tenant'), 'Bata & Batu',     '🧱'),
  ((SELECT val FROM _ids WHERE key='cat_cat'),     (SELECT val FROM _ids WHERE key='tenant'), 'Cat & Pelapis',   '🎨'),
  ((SELECT val FROM _ids WHERE key='cat_pipa'),    (SELECT val FROM _ids WHERE key='tenant'), 'Pipa & Sanitasi', '🚿'),
  ((SELECT val FROM _ids WHERE key='cat_besi'),    (SELECT val FROM _ids WHERE key='tenant'), 'Besi & Rangka',   '⚙️'),
  ((SELECT val FROM _ids WHERE key='cat_keramik'), (SELECT val FROM _ids WHERE key='tenant'), 'Keramik & Lantai','🪟');


-- =============================================================================
-- 6. PRODUCTS (master, terpusat per tenant)
-- =============================================================================
INSERT INTO products (id, tenant_id, sku, name, category_id, unit, purchase_price, is_active)
VALUES
  ((SELECT val FROM _ids WHERE key='p_001'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-001','Semen Portland 50kg',  (SELECT val FROM _ids WHERE key='cat_semen'),  'sak',    57000, TRUE),
  ((SELECT val FROM _ids WHERE key='p_002'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-002','Bata Merah',           (SELECT val FROM _ids WHERE key='cat_bata'),   'pcs',      800, TRUE),
  ((SELECT val FROM _ids WHERE key='p_003'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-003','Cat Tembok Putih 5kg', (SELECT val FROM _ids WHERE key='cat_cat'),    'kaleng', 38000, TRUE),
  ((SELECT val FROM _ids WHERE key='p_004'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-004','Pipa PVC 3/4"',        (SELECT val FROM _ids WHERE key='cat_pipa'),   'btg',    18000, TRUE),
  ((SELECT val FROM _ids WHERE key='p_005'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-005','Keramik 40x40 Putih',  (SELECT val FROM _ids WHERE key='cat_keramik'),'dus',    65000, TRUE),
  ((SELECT val FROM _ids WHERE key='p_006'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-006','Bata Ringan 7.5cm',   (SELECT val FROM _ids WHERE key='cat_bata'),   'kubik',  65000, TRUE),
  ((SELECT val FROM _ids WHERE key='p_007'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-007','Besi Hollow 4x4',     (SELECT val FROM _ids WHERE key='cat_besi'),   'btg',    85000, TRUE),
  ((SELECT val FROM _ids WHERE key='p_008'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-008','Cat Besi Hitam 1kg',  (SELECT val FROM _ids WHERE key='cat_cat'),    'kaleng', 28000, TRUE),
  ((SELECT val FROM _ids WHERE key='p_009'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-009','Triplek 9mm',         (SELECT val FROM _ids WHERE key='cat_besi'),   'lbr',    95000, TRUE),
  ((SELECT val FROM _ids WHERE key='p_010'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-010','Genteng Beton',       (SELECT val FROM _ids WHERE key='cat_bata'),   'pcs',     3500, TRUE),
  ((SELECT val FROM _ids WHERE key='p_011'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-011','Kawat Beton 1kg',     (SELECT val FROM _ids WHERE key='cat_besi'),   'kg',     18000, TRUE),
  ((SELECT val FROM _ids WHERE key='p_012'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-012','Paku Beton 3"',       (SELECT val FROM _ids WHERE key='cat_besi'),   'kg',     12000, TRUE);


-- =============================================================================
-- 7. BRANCH_PRODUCTS (stok & harga jual per cabang)
-- =============================================================================

-- ── Cabang Sudirman ──────────────────────────────────────────────────────────
INSERT INTO branch_products
  (tenant_id, branch_id, product_id, selling_price, stock, legacy_stock, reorder_point, warehouse_location)
SELECT
  (SELECT val FROM _ids WHERE key='tenant'),
  (SELECT val FROM _ids WHERE key='br_sudirman'),
  (SELECT val FROM _ids WHERE key=p_key),
  sp, st, ls, rp, loc
FROM (VALUES
  ('p_001', 65000,  80,    0, 20,  'A-01'),
  ('p_002',  1100, 1200,   0, 500, 'B-03'),
  ('p_003', 45000,   0,    3, 10,  'C-02'),  -- 🔴 kritis: pakai legacy_stock
  ('p_004', 22000,   8,    0, 15,  'D-04'),  -- 🟡 menipis
  ('p_005', 78000,  30,    0, 10,  'E-01'),
  ('p_006', 85000,   5,    0,  8,  'B-05'),  -- 🟡 menipis
  ('p_007',105000,  25,    0, 10,  'F-02'),
  ('p_008', 35000,  12,    0,  5,  'C-03'),
  ('p_009',120000,  40,    0, 15,  'G-01'),
  ('p_010',  5000, 200,    0, 100, 'H-02'),
  ('p_011', 23000,   2,    0, 10,  'F-04'),  -- 🔴 kritis
  ('p_012', 16000,  30,    0, 10,  'F-05')
) AS t(p_key, sp, st, ls, rp, loc);

-- ── Cabang Kebon Jeruk ───────────────────────────────────────────────────────
INSERT INTO branch_products
  (tenant_id, branch_id, product_id, selling_price, stock, legacy_stock, reorder_point, warehouse_location)
SELECT
  (SELECT val FROM _ids WHERE key='tenant'),
  (SELECT val FROM _ids WHERE key='br_kebonjeruk'),
  (SELECT val FROM _ids WHERE key=p_key),
  sp, st, ls, rp, 'KBJ-01'
FROM (VALUES
  ('p_001', 66000,  45,  0, 15),  -- harga lebih tinggi
  ('p_002',  1100, 800,  0, 400),
  ('p_003', 46000,   5, 10, 10),  -- ada legacy_stock
  ('p_004', 22000,  20,  0, 10),
  ('p_005', 79000,  20,  0, 10),  -- harga lebih tinggi
  ('p_006', 85000,  12,  0,  8),
  ('p_007',105000,   8,  0, 10),  -- 🟡 menipis
  ('p_008', 35000,  10,  0,  5),
  ('p_009',120000,  25,  0, 15),
  ('p_010',  5000, 150,  0, 80),
  ('p_011', 23000,  15,  0, 10),
  ('p_012', 16000,  20,  0, 10)
) AS t(p_key, sp, st, ls, rp);

-- ── Cabang Bekasi ─────────────────────────────────────────────────────────────
INSERT INTO branch_products
  (tenant_id, branch_id, product_id, selling_price, stock, legacy_stock, reorder_point, warehouse_location)
SELECT
  (SELECT val FROM _ids WHERE key='tenant'),
  (SELECT val FROM _ids WHERE key='br_bekasi'),
  (SELECT val FROM _ids WHERE key=p_key),
  sp, st, ls, rp, 'BKS-01'
FROM (VALUES
  ('p_001', 64000, 120,  0, 30),  -- harga lebih murah, stok banyak
  ('p_002',  1100, 500,  0, 200),
  ('p_003', 45000,  12,  0, 10),
  ('p_004', 22000,   8,  0, 20),  -- 🟡 menipis
  ('p_005', 78000,  35,  0, 10),
  ('p_006', 85000,   2,  0,  8),  -- 🔴 kritis
  ('p_007',105000,  30,  0, 10),
  ('p_008', 35000,  18,  0,  5),
  ('p_009',120000,  50,  0, 15),
  ('p_010',  5000, 300,  0, 100),
  ('p_011', 23000,  20,  0, 10),
  ('p_012', 16000,  40,  0, 10)
) AS t(p_key, sp, st, ls, rp);


-- =============================================================================
-- 8. CUSTOMERS
-- =============================================================================
INSERT INTO customers (id, tenant_id, name, phone, type, credit_limit, outstanding_debt)
VALUES
  (
    (SELECT val FROM _ids WHERE key='cust_abadi'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'PT Abadi Jaya Konstruksi', '0812-1111-2222',
    'credit', 50000000, 12000000
  ),
  (
    (SELECT val FROM _ids WHERE key='cust_budi'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'Toko Pak Budi', '0813-3333-4444',
    'credit', 10000000, 5500000
  ),
  (
    (SELECT val FROM _ids WHERE key='cust_umum'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'Pelanggan Umum', NULL,
    'retail', 0, 0
  );


-- =============================================================================
-- 9. SUPPLIERS
-- =============================================================================
INSERT INTO suppliers
  (id, tenant_id, name, contact_person, phone, payment_term_days, outstanding_debt, is_active)
VALUES
  (
    (SELECT val FROM _ids WHERE key='sup_semen'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'PT Sumber Semen Indonesia', 'Pak Hari', '081234567890',
    30, 25000000, TRUE
  ),
  (
    (SELECT val FROM _ids WHERE key='sup_besi'),
    (SELECT val FROM _ids WHERE key='tenant'),
    'Toko Besi Makmur', 'Bu Ani', '081298765432',
    14, 8500000, TRUE
  );


-- =============================================================================
-- 10. CASH_ACCOUNTS (Cabang Sudirman)
-- =============================================================================
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
  );


-- =============================================================================
-- 11. ACCOUNTS_RECEIVABLE
-- =============================================================================
INSERT INTO accounts_receivable
  (tenant_id, branch_id, invoice_number, customer_id, customer_name,
   total_amount, paid_amount, due_date, status)
VALUES
  (
    (SELECT val FROM _ids WHERE key='tenant'),
    (SELECT val FROM _ids WHERE key='br_sudirman'),
    'INV-AR-2025-01-001',
    (SELECT val FROM _ids WHERE key='cust_abadi'),
    'PT Abadi Jaya Konstruksi',
    12000000, 0,
    CURRENT_DATE - INTERVAL '10 days',  -- sudah lewat jatuh tempo → overdue
    'overdue'
  ),
  (
    (SELECT val FROM _ids WHERE key='tenant'),
    (SELECT val FROM _ids WHERE key='br_sudirman'),
    'INV-AR-2025-01-002',
    (SELECT val FROM _ids WHERE key='cust_budi'),
    'Toko Pak Budi',
    5500000, 0,
    CURRENT_DATE + INTERVAL '3 days',  -- belum jatuh tempo
    'unpaid'
  );


-- =============================================================================
-- 12. ACCOUNTS_PAYABLE
-- =============================================================================
INSERT INTO accounts_payable
  (tenant_id, branch_id, invoice_number, supplier_id, supplier_name,
   total_amount, paid_amount, due_date, status)
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
  );


-- =============================================================================
-- 13. CASHIER SESSION (untuk 30 hari transaksi)
-- Buat satu sesi per hari (simplified — sesi dibuka tiap pagi oleh Andi)
-- =============================================================================
CREATE TEMP TABLE _sessions AS
SELECT
  gen_random_uuid() AS id,
  (SELECT val FROM _ids WHERE key='tenant') AS tenant_id,
  (SELECT val FROM _ids WHERE key='br_sudirman') AS branch_id,
  (SELECT val FROM _ids WHERE key='u_andi') AS cashier_id,
  'closed'::session_status AS status,
  (CURRENT_DATE - (29 - d) * INTERVAL '1 day') + INTERVAL '8 hours' AS opened_at,
  (CURRENT_DATE - (29 - d) * INTERVAL '1 day') + INTERVAL '18 hours' AS closed_at,
  5000000 AS opening_cash_balance,
  d
FROM generate_series(0, 29) AS d;

INSERT INTO cashier_sessions
  (id, tenant_id, branch_id, cashier_id, status, opened_at, closed_at, opening_cash_balance)
SELECT id, tenant_id, branch_id, cashier_id, status, opened_at, closed_at, opening_cash_balance
FROM _sessions;


-- =============================================================================
-- 14. SALES_TRANSACTIONS — 30 hari historis
-- Pattern realistis berdasarkan hari dalam seminggu.
-- Setiap "transaksi" adalah 1 baris sales_transactions + beberapa sales_items.
-- =============================================================================

DO $sales_gen$
DECLARE
  v_day         INT;
  v_dow         INT;   -- 0=Sun, 1=Mon, ..., 6=Sat
  v_tx_count    INT;
  v_tx          INT;
  v_tx_date     TIMESTAMPTZ;
  v_session_id  UUID;
  v_tx_id       UUID;
  v_tx_number   TEXT;
  v_cashier     UUID;
  v_pay         payment_method;
  v_grand       BIGINT;
  v_amount_paid BIGINT;
  v_customer_id UUID;
  v_customer_nm TEXT;
  v_tenant      UUID;
  v_branch      UUID;

  -- product pool: (product_id, selling_price, purchase_price)
  v_products    UUID[];
  v_prices      BIGINT[];
  v_costs       BIGINT[];
  v_item_count  INT;
  v_prod_idx    INT;
  v_qty         INT;
  v_unit_price  BIGINT;
  v_unit_cost   BIGINT;
  v_subtotal    BIGINT;

BEGIN
  v_tenant := (SELECT val FROM _ids WHERE key='tenant');
  v_branch := (SELECT val FROM _ids WHERE key='br_sudirman');

  -- Load product arrays (Sudirman selling prices)
  SELECT
    ARRAY_AGG(bp.product_id ORDER BY p.sku),
    ARRAY_AGG(bp.selling_price ORDER BY p.sku),
    ARRAY_AGG(p.purchase_price ORDER BY p.sku)
  INTO v_products, v_prices, v_costs
  FROM branch_products bp
  JOIN products p ON p.id = bp.product_id
  WHERE bp.branch_id = v_branch AND bp.tenant_id = v_tenant;

  FOR v_day IN 0..29 LOOP
    -- Day-of-week for the date
    v_dow := EXTRACT(DOW FROM (CURRENT_DATE - (29 - v_day) * INTERVAL '1 day'));

    -- Transaction count based on day of week
    v_tx_count := CASE
      WHEN v_dow = 0 THEN 5 + floor(random()*3)::INT   -- Minggu: 5-8
      WHEN v_dow = 6 THEN 15 + floor(random()*10)::INT -- Sabtu: 15-25
      ELSE 8 + floor(random()*8)::INT                   -- Weekday: 8-15
    END;

    -- Session for this day
    SELECT id INTO v_session_id FROM _sessions WHERE d = v_day;

    FOR v_tx IN 1..v_tx_count LOOP
      v_tx_id     := gen_random_uuid();
      v_tx_number := 'TRX-' ||
                     TO_CHAR(CURRENT_DATE - (29-v_day)*INTERVAL '1 day', 'YYYYMMDD') ||
                     '-' || LPAD(v_tx::TEXT, 3, '0');

      -- Waktu transaksi antara jam 08:00 - 18:00
      v_tx_date := (CURRENT_DATE - (29-v_day)*INTERVAL '1 day') +
                   (8 * 60 + floor(random()*600))::INT * INTERVAL '1 minute';

      -- Cashier: Andi pagi, Siti sore (alternating by tx index)
      v_cashier := CASE WHEN v_tx % 2 = 0
        THEN (SELECT val FROM _ids WHERE key='u_andi')
        ELSE (SELECT val FROM _ids WHERE key='u_siti')
      END;

      -- Payment mix: 60% cash, 20% transfer, 15% qris_gopay, 5% credit
      v_pay := CASE
        WHEN random() < 0.60 THEN 'cash'::payment_method
        WHEN random() < 0.80 THEN 'transfer'::payment_method
        WHEN random() < 0.95 THEN 'qris_gopay'::payment_method
        ELSE 'credit'::payment_method
      END;

      -- Customer: credit transactions get a real customer; rest get Pelanggan Umum
      IF v_pay = 'credit' THEN
        v_customer_id := CASE WHEN random() < 0.6
          THEN (SELECT val FROM _ids WHERE key='cust_abadi')
          ELSE (SELECT val FROM _ids WHERE key='cust_budi')
        END;
        v_customer_nm := CASE WHEN v_customer_id = (SELECT val FROM _ids WHERE key='cust_abadi')
          THEN 'PT Abadi Jaya Konstruksi'
          ELSE 'Toko Pak Budi'
        END;
      ELSE
        v_customer_id := NULL;
        v_customer_nm := 'Pelanggan Umum';
      END IF;

      -- Grand total: weekday 150k–600k, Sabtu bigger, Minggu smaller
      v_grand := CASE
        WHEN v_dow = 0 THEN (100000 + floor(random()*200000)::BIGINT)
        WHEN v_dow = 6 THEN (200000 + floor(random()*600000)::BIGINT)
        ELSE (150000 + floor(random()*450000)::BIGINT)
      END;

      v_amount_paid := CASE WHEN v_pay = 'credit' THEN 0
                            ELSE v_grand + (floor(random()*50000/1000)*1000)::BIGINT
                       END;

      INSERT INTO sales_transactions (
        id, tenant_id, branch_id, session_id,
        transaction_number, customer_id, customer_name,
        subtotal, discount_amount, tax_amount, grand_total,
        payment_method, amount_paid, change_amount,
        input_by, paid_by,
        is_cross_session, has_legacy_items, is_offline_transaction,
        sync_status, status, created_at
      ) VALUES (
        v_tx_id, v_tenant, v_branch, v_session_id,
        v_tx_number, v_customer_id, v_customer_nm,
        v_grand, 0, 0, v_grand,
        v_pay, v_amount_paid, GREATEST(0, v_amount_paid - v_grand),
        v_cashier, v_cashier,
        FALSE, FALSE, FALSE,
        'synced', 'completed', v_tx_date
      );

      -- Sales items: 1-3 items per transaction
      v_item_count := 1 + floor(random()*2)::INT;
      FOR i IN 1..v_item_count LOOP
        v_prod_idx  := 1 + floor(random()*array_length(v_products,1))::INT;
        v_prod_idx  := LEAST(v_prod_idx, array_length(v_products,1));
        v_qty       := 1 + floor(random()*4)::INT;
        v_unit_price := v_prices[v_prod_idx];
        v_unit_cost  := v_costs[v_prod_idx];
        v_subtotal   := v_unit_price * v_qty;

        INSERT INTO sales_items (
          transaction_id, tenant_id, product_id,
          product_name, sku, unit,
          qty, purchase_price, selling_price, discount, subtotal,
          stock_source
        )
        SELECT
          v_tx_id, v_tenant, p.id,
          p.name, p.sku, p.unit,
          v_qty, v_unit_cost, v_unit_price, 0, v_subtotal,
          'verified'
        FROM products p
        WHERE p.id = v_products[v_prod_idx];
      END LOOP;

    END LOOP; -- tx loop
  END LOOP;   -- day loop
END;
$sales_gen$;


-- =============================================================================
-- 15. Update cashier_sessions totals from generated transactions
-- =============================================================================
UPDATE cashier_sessions cs
SET
  total_transactions  = agg.cnt,
  total_sales         = agg.total,
  total_cash_sales    = agg.cash_total,
  total_card_sales    = 0,
  total_transfer_sales = agg.transfer_total,
  total_credit_sales  = agg.credit_total,
  expected_cash_balance = cs.opening_cash_balance + agg.cash_total,
  actual_cash_balance   = cs.opening_cash_balance + agg.cash_total
    + (floor(random()*10000) - 5000)::BIGINT  -- simulasi selisih kecil
FROM (
  SELECT
    session_id,
    COUNT(*)                                                   AS cnt,
    SUM(grand_total)                                           AS total,
    SUM(CASE WHEN payment_method = 'cash'     THEN grand_total ELSE 0 END) AS cash_total,
    SUM(CASE WHEN payment_method = 'transfer' THEN grand_total ELSE 0 END) AS transfer_total,
    SUM(CASE WHEN payment_method = 'credit'   THEN grand_total ELSE 0 END) AS credit_total
  FROM sales_transactions
  GROUP BY session_id
) agg
WHERE cs.id = agg.session_id;


-- =============================================================================
-- CLEANUP
-- =============================================================================
DROP TABLE _sessions;
DROP TABLE _ids;

COMMIT;

-- =============================================================================
-- END OF MIGRATION 003
-- =============================================================================

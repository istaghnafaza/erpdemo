-- =============================================================================
-- SES — Neon Phase 2 Seed (products, branch_products, customers)
-- Run AFTER phase1_schema.sql, phase1_seed.sql, phase2_schema.sql
-- Tenant & branch IDs match phase1_seed.sql / mock demo.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _ids (key TEXT PRIMARY KEY, val UUID);

INSERT INTO _ids VALUES
  ('tenant',        '11111111-0000-0000-0000-000000000001'),
  ('br_sudirman',   '22221111-0000-0000-0000-000000000001'),
  ('br_kebonjeruk', '22221111-0000-0000-0000-000000000002'),
  ('br_bekasi',     '22221111-0000-0000-0000-000000000003'),
  ('cat_semen',     '44441111-0000-0000-0000-000000000001'),
  ('cat_bata',      '44441111-0000-0000-0000-000000000002'),
  ('cat_cat',       '44441111-0000-0000-0000-000000000003'),
  ('cat_pipa',      '44441111-0000-0000-0000-000000000004'),
  ('cat_besi',      '44441111-0000-0000-0000-000000000005'),
  ('cat_keramik',   '44441111-0000-0000-0000-000000000006'),
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
  ('cust_abadi',    '66661111-0000-0000-0000-000000000001'),
  ('cust_budi',     '66661111-0000-0000-0000-000000000002'),
  ('cust_umum',     '66661111-0000-0000-0000-000000000003');

-- Product categories
INSERT INTO product_categories (id, tenant_id, name, icon)
VALUES
  ((SELECT val FROM _ids WHERE key='cat_semen'),   (SELECT val FROM _ids WHERE key='tenant'), 'Semen',            '🏗️'),
  ((SELECT val FROM _ids WHERE key='cat_bata'),    (SELECT val FROM _ids WHERE key='tenant'), 'Bata & Batu',      '🧱'),
  ((SELECT val FROM _ids WHERE key='cat_cat'),     (SELECT val FROM _ids WHERE key='tenant'), 'Cat & Pelapis',    '🎨'),
  ((SELECT val FROM _ids WHERE key='cat_pipa'),    (SELECT val FROM _ids WHERE key='tenant'), 'Pipa & Sanitasi',  '🚿'),
  ((SELECT val FROM _ids WHERE key='cat_besi'),    (SELECT val FROM _ids WHERE key='tenant'), 'Besi & Rangka',    '⚙️'),
  ((SELECT val FROM _ids WHERE key='cat_keramik'), (SELECT val FROM _ids WHERE key='tenant'), 'Keramik & Lantai', '🪟')
ON CONFLICT DO NOTHING;

-- Products (master)
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
  ((SELECT val FROM _ids WHERE key='p_012'),(SELECT val FROM _ids WHERE key='tenant'),'BRG-012','Paku Beton 3"',       (SELECT val FROM _ids WHERE key='cat_besi'),   'kg',     12000, TRUE)
ON CONFLICT DO NOTHING;

-- Branch products — Sudirman
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
  ('p_003', 45000,   0,    3, 10,  'C-02'),
  ('p_004', 22000,   8,    0, 15,  'D-04'),
  ('p_005', 78000,  30,    0, 10,  'E-01'),
  ('p_006', 85000,   5,    0,  8,  'B-05'),
  ('p_007',105000,  25,    0, 10,  'F-02'),
  ('p_008', 35000,  12,    0,  5,  'C-03'),
  ('p_009',120000,  40,    0, 15,  'G-01'),
  ('p_010',  5000, 200,    0, 100, 'H-02'),
  ('p_011', 23000,   2,    0, 10,  'F-04'),
  ('p_012', 16000,  30,    0, 10,  'F-05')
) AS t(p_key, sp, st, ls, rp, loc)
ON CONFLICT DO NOTHING;

-- Branch products — Kebon Jeruk
INSERT INTO branch_products
  (tenant_id, branch_id, product_id, selling_price, stock, legacy_stock, reorder_point, warehouse_location)
SELECT
  (SELECT val FROM _ids WHERE key='tenant'),
  (SELECT val FROM _ids WHERE key='br_kebonjeruk'),
  (SELECT val FROM _ids WHERE key=p_key),
  sp, st, ls, rp, 'KBJ-01'
FROM (VALUES
  ('p_001', 66000,  45,  0, 15),
  ('p_002',  1100, 800,  0, 400),
  ('p_003', 46000,   5, 10, 10),
  ('p_004', 22000,  20,  0, 10),
  ('p_005', 79000,  20,  0, 10),
  ('p_006', 85000,  12,  0,  8),
  ('p_007',105000,   8,  0, 10),
  ('p_008', 35000,  10,  0,  5),
  ('p_009',120000,  25,  0, 15),
  ('p_010',  5000, 150,  0, 80),
  ('p_011', 23000,  15,  0, 10),
  ('p_012', 16000,  20,  0, 10)
) AS t(p_key, sp, st, ls, rp)
ON CONFLICT DO NOTHING;

-- Branch products — Bekasi
INSERT INTO branch_products
  (tenant_id, branch_id, product_id, selling_price, stock, legacy_stock, reorder_point, warehouse_location)
SELECT
  (SELECT val FROM _ids WHERE key='tenant'),
  (SELECT val FROM _ids WHERE key='br_bekasi'),
  (SELECT val FROM _ids WHERE key=p_key),
  sp, st, ls, rp, 'BKS-01'
FROM (VALUES
  ('p_001', 64000, 120,  0, 30),
  ('p_002',  1100, 500,  0, 200),
  ('p_003', 45000,  12,  0, 10),
  ('p_004', 22000,   8,  0, 20),
  ('p_005', 78000,  35,  0, 10),
  ('p_006', 85000,   2,  0,  8),
  ('p_007',105000,  30,  0, 10),
  ('p_008', 35000,  18,  0,  5),
  ('p_009',120000,  50,  0, 15),
  ('p_010',  5000, 300,  0, 100),
  ('p_011', 23000,  20,  0, 10),
  ('p_012', 16000,  40,  0, 10)
) AS t(p_key, sp, st, ls, rp)
ON CONFLICT DO NOTHING;

-- Customers
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
  )
ON CONFLICT DO NOTHING;

COMMIT;

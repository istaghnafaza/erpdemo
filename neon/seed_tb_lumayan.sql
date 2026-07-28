-- =============================================================================
-- SEPS — Seed tenant uji coba: TB Lumayan
-- Password semua akun: 111111 | PIN: 111111
-- Isi: tenant, cabang, user, kategori, produk, stok, pelanggan, supplier
-- Tanpa: penjualan, pengiriman, keuangan, AR/AP, stock_movements
-- Idempotent: aman di-run ulang (ON CONFLICT DO NOTHING)
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _lum (key TEXT PRIMARY KEY, val UUID);

INSERT INTO _lum VALUES
  ('tenant',      '11111111-0000-0000-0000-000000000002'),
  ('br_pusat',    '22221111-0000-0000-0000-000000000010'),
  ('br_cabang',   '22221111-0000-0000-0000-000000000011'),
  ('u_owner',     '33331111-0000-0000-0000-000000000010'),
  ('u_manager',   '33331111-0000-0000-0000-000000000011'),
  ('u_kasir',     '33331111-0000-0000-0000-000000000012'),
  ('u_gudang',    '33331111-0000-0000-0000-000000000013'),
  ('cat_semen',   '44441111-0000-0000-0000-000000000010'),
  ('cat_bata',    '44441111-0000-0000-0000-000000000011'),
  ('cat_cat',     '44441111-0000-0000-0000-000000000012'),
  ('cat_pipa',    '44441111-0000-0000-0000-000000000013'),
  ('cat_besi',    '44441111-0000-0000-0000-000000000014'),
  ('cat_keramik', '44441111-0000-0000-0000-000000000015'),
  ('p_01', '55552222-0000-0000-0000-000000000001'),
  ('p_02', '55552222-0000-0000-0000-000000000002'),
  ('p_03', '55552222-0000-0000-0000-000000000003'),
  ('p_04', '55552222-0000-0000-0000-000000000004'),
  ('p_05', '55552222-0000-0000-0000-000000000005'),
  ('p_06', '55552222-0000-0000-0000-000000000006'),
  ('p_07', '55552222-0000-0000-0000-000000000007'),
  ('p_08', '55552222-0000-0000-0000-000000000008'),
  ('p_09', '55552222-0000-0000-0000-000000000009'),
  ('p_10', '55552222-0000-0000-0000-000000000010'),
  ('p_11', '55552222-0000-0000-0000-000000000011'),
  ('p_12', '55552222-0000-0000-0000-000000000012'),
  ('p_13', '55552222-0000-0000-0000-000000000013'),
  ('p_14', '55552222-0000-0000-0000-000000000014'),
  ('p_15', '55552222-0000-0000-0000-000000000015'),
  ('cust_01', '66661111-0000-0000-0000-000000000010'),
  ('cust_02', '66661111-0000-0000-0000-000000000011'),
  ('cust_03', '66661111-0000-0000-0000-000000000012'),
  ('cust_04', '66661111-0000-0000-0000-000000000013'),
  ('cust_05', '66661111-0000-0000-0000-000000000014'),
  ('cust_06', '66661111-0000-0000-0000-000000000015'),
  ('cust_07', '66661111-0000-0000-0000-000000000016'),
  ('cust_08', '66661111-0000-0000-0000-000000000017'),
  ('sup_01',  '77771111-0000-0000-0000-000000000010'),
  ('sup_02',  '77771111-0000-0000-0000-000000000011'),
  ('sup_03',  '77771111-0000-0000-0000-000000000012'),
  ('sup_04',  '77771111-0000-0000-0000-000000000013'),
  ('sup_05',  '77771111-0000-0000-0000-000000000014');

-- ---------------------------------------------------------------------------
-- Tenant & cabang
-- ---------------------------------------------------------------------------
INSERT INTO tenants (id, name, slug, owner_email, phone, plan, is_active, onboarding_complete, legacy_mode_active)
VALUES (
  (SELECT val FROM _lum WHERE key = 'tenant'),
  'TB Lumayan',
  'tb-lumayan',
  'owner@seps.id',
  '021-8899001',
  'pro',
  TRUE,
  TRUE,
  FALSE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO branches (id, tenant_id, code, name, address, phone, is_active)
VALUES
  (
    (SELECT val FROM _lum WHERE key = 'br_pusat'),
    (SELECT val FROM _lum WHERE key = 'tenant'),
    'PST',
    'TB Lumayan Pusat',
    'Jl. Raya Lumayan No. 88, Jakarta Timur',
    '021-8899001',
    TRUE
  ),
  (
    (SELECT val FROM _lum WHERE key = 'br_cabang'),
    (SELECT val FROM _lum WHERE key = 'tenant'),
    'CNG',
    'TB Lumayan Cabang Bekasi',
    'Jl. Ahmad Yani No. 120, Bekasi',
    '021-8899002',
    TRUE
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Auth + profiles (password: 111111)
-- ---------------------------------------------------------------------------
INSERT INTO auth_users (id, email, password_hash, tenant_id)
SELECT uid, eml, crypt('111111', gen_salt('bf')), (SELECT val FROM _lum WHERE key = 'tenant')
FROM (VALUES
  ((SELECT val FROM _lum WHERE key = 'u_owner'),   'owner@seps.id'),
  ((SELECT val FROM _lum WHERE key = 'u_manager'), 'manager@seps.id'),
  ((SELECT val FROM _lum WHERE key = 'u_kasir'),   'kasir@seps.id'),
  ((SELECT val FROM _lum WHERE key = 'u_gudang'),  'gudang@seps.id')
) AS t(uid, eml)
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, tenant_id, name, email, role, pin, is_active)
VALUES
  ((SELECT val FROM _lum WHERE key = 'u_owner'),   (SELECT val FROM _lum WHERE key = 'tenant'), 'Ahmad Lumayan',    'owner@seps.id',   'owner',     '111111', TRUE),
  ((SELECT val FROM _lum WHERE key = 'u_manager'), (SELECT val FROM _lum WHERE key = 'tenant'), 'Rina Manajer',     'manager@seps.id', 'manager',   '111111', TRUE),
  ((SELECT val FROM _lum WHERE key = 'u_kasir'),   (SELECT val FROM _lum WHERE key = 'tenant'), 'Dedi Kasir',       'kasir@seps.id',   'cashier',   '111111', TRUE),
  ((SELECT val FROM _lum WHERE key = 'u_gudang'),  (SELECT val FROM _lum WHERE key = 'tenant'), 'Bambang Gudang',   'gudang@seps.id',  'warehouse', '111111', TRUE)
ON CONFLICT (id) DO NOTHING;

UPDATE branches
SET manager_id = (SELECT val FROM _lum WHERE key = 'u_manager')
WHERE id = (SELECT val FROM _lum WHERE key = 'br_pusat')
  AND tenant_id = (SELECT val FROM _lum WHERE key = 'tenant');

INSERT INTO user_branches (user_id, branch_id, tenant_id)
SELECT u.val, b.val, (SELECT val FROM _lum WHERE key = 'tenant')
FROM (VALUES
  ('u_owner',   'br_pusat'),
  ('u_owner',   'br_cabang'),
  ('u_manager', 'br_pusat'),
  ('u_manager', 'br_cabang'),
  ('u_kasir',   'br_pusat'),
  ('u_gudang',  'br_pusat'),
  ('u_gudang',  'br_cabang')
) AS t(u_key, b_key)
JOIN _lum u ON u.key = t.u_key
JOIN _lum b ON b.key = t.b_key
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Kategori produk
-- ---------------------------------------------------------------------------
INSERT INTO product_categories (id, tenant_id, name, icon)
VALUES
  ((SELECT val FROM _lum WHERE key = 'cat_semen'),   (SELECT val FROM _lum WHERE key = 'tenant'), 'Semen & Mortar',     '🏗️'),
  ((SELECT val FROM _lum WHERE key = 'cat_bata'),    (SELECT val FROM _lum WHERE key = 'tenant'), 'Bata & Batako',      '🧱'),
  ((SELECT val FROM _lum WHERE key = 'cat_cat'),     (SELECT val FROM _lum WHERE key = 'tenant'), 'Cat & Waterproof', '🎨'),
  ((SELECT val FROM _lum WHERE key = 'cat_pipa'),    (SELECT val FROM _lum WHERE key = 'tenant'), 'Pipa & Fitting',     '🚿'),
  ((SELECT val FROM _lum WHERE key = 'cat_besi'),    (SELECT val FROM _lum WHERE key = 'tenant'), 'Besi & Atap',        '⚙️'),
  ((SELECT val FROM _lum WHERE key = 'cat_keramik'), (SELECT val FROM _lum WHERE key = 'tenant'), 'Keramik & Granit',   '🪟')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Master produk (15 SKU)
-- ---------------------------------------------------------------------------
INSERT INTO products (id, tenant_id, sku, barcode, name, category_id, unit, purchase_price, is_active)
VALUES
  ((SELECT val FROM _lum WHERE key = 'p_01'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-001', '8991001000010', 'Semen Gresik 50kg',         (SELECT val FROM _lum WHERE key = 'cat_semen'),   'sak',    58000, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_02'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-002', '8991001000027', 'Semen Tiga Roda 40kg',      (SELECT val FROM _lum WHERE key = 'cat_semen'),   'sak',    52000, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_03'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-003', '8991001000034', 'Bata Merah Press',          (SELECT val FROM _lum WHERE key = 'cat_bata'),    'pcs',      850, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_04'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-004', '8991001000041', 'Batako Press 10x20x40',     (SELECT val FROM _lum WHERE key = 'cat_bata'),    'pcs',     3200, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_05'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-005', '8991001000058', 'Cat Tembok Avian 25kg',     (SELECT val FROM _lum WHERE key = 'cat_cat'),     'pail',  185000, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_06'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-006', '8991001000065', 'Cat Kayu Gloss 1kg',        (SELECT val FROM _lum WHERE key = 'cat_cat'),     'kaleng', 32000, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_07'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-007', '8991001000072', 'Pipa PVC AW 2"',            (SELECT val FROM _lum WHERE key = 'cat_pipa'),   'btg',    42000, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_08'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-008', '8991001000089', 'Pipa PVC 3/4"',             (SELECT val FROM _lum WHERE key = 'cat_pipa'),   'btg',    19000, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_09'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-009', '8991001000096', 'Keramik 60x60 Abu',         (SELECT val FROM _lum WHERE key = 'cat_keramik'), 'dus',    89000, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_10'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-010', '8991001000102', 'Granit 80x80 Marmer',       (SELECT val FROM _lum WHERE key = 'cat_keramik'), 'dus',   145000, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_11'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-011', '8991001000119', 'Besi Beton 10mm',           (SELECT val FROM _lum WHERE key = 'cat_besi'),   'btg',    78000, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_12'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-012', '8991001000126', 'Besi Hollow 4x4 6m',        (SELECT val FROM _lum WHERE key = 'cat_besi'),   'btg',    92000, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_13'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-013', '8991001000133', 'Genteng Metal Pasir',       (SELECT val FROM _lum WHERE key = 'cat_besi'),   'lbr',    68000, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_14'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-014', '8991001000140', 'Pasir Cor 1 m3',            (SELECT val FROM _lum WHERE key = 'cat_semen'),   'm3',    320000, TRUE),
  ((SELECT val FROM _lum WHERE key = 'p_15'), (SELECT val FROM _lum WHERE key = 'tenant'), 'LMY-015', '8991001000157', 'Paku Beton 4"',             (SELECT val FROM _lum WHERE key = 'cat_besi'),   'kg',     14000, TRUE)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Stok per cabang — Pusat
-- ---------------------------------------------------------------------------
INSERT INTO branch_products
  (tenant_id, branch_id, product_id, selling_price, stock, legacy_stock, reorder_point, warehouse_location)
SELECT
  (SELECT val FROM _lum WHERE key = 'tenant'),
  (SELECT val FROM _lum WHERE key = 'br_pusat'),
  (SELECT val FROM _lum WHERE key = p_key),
  sp, st, 0, rp, loc
FROM (VALUES
  ('p_01',  68000,  150, 25, 'A-01'),
  ('p_02',  62000,   80, 20, 'A-02'),
  ('p_03',   1100, 2000, 500, 'B-01'),
  ('p_04',   4200,  800, 200, 'B-02'),
  ('p_05', 215000,   25,  5, 'C-01'),
  ('p_06',  42000,   40, 10, 'C-02'),
  ('p_07',  52000,   60, 15, 'D-01'),
  ('p_08',  24000,  100, 20, 'D-02'),
  ('p_09', 105000,   45, 10, 'E-01'),
  ('p_10', 175000,   20,  5, 'E-02'),
  ('p_11',  92000,  120, 30, 'F-01'),
  ('p_12', 108000,   85, 20, 'F-02'),
  ('p_13',  82000,   55, 15, 'G-01'),
  ('p_14', 380000,   12,  3, 'H-01'),
  ('p_15',  18000,   50, 10, 'F-03')
) AS t(p_key, sp, st, rp, loc)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Stok per cabang — Bekasi
-- ---------------------------------------------------------------------------
INSERT INTO branch_products
  (tenant_id, branch_id, product_id, selling_price, stock, legacy_stock, reorder_point, warehouse_location)
SELECT
  (SELECT val FROM _lum WHERE key = 'tenant'),
  (SELECT val FROM _lum WHERE key = 'br_cabang'),
  (SELECT val FROM _lum WHERE key = p_key),
  sp, st, 0, rp, 'BKS-' || loc
FROM (VALUES
  ('p_01',  67000,  90, 20, '01'),
  ('p_02',  61000,  50, 15, '02'),
  ('p_03',   1100, 1200, 300, '03'),
  ('p_04',   4200,  400, 100, '04'),
  ('p_05', 215000,   12,  4, '05'),
  ('p_06',  42000,   25,  8, '06'),
  ('p_07',  52000,   35, 10, '07'),
  ('p_08',  24000,   70, 15, '08'),
  ('p_09', 105000,   30,  8, '09'),
  ('p_10', 175000,   10,  4, '10'),
  ('p_11',  92000,   60, 15, '11'),
  ('p_12', 108000,   40, 12, '12'),
  ('p_13',  82000,   30, 10, '13'),
  ('p_14', 380000,    6,  2, '14'),
  ('p_15',  18000,   35,  8, '15')
) AS t(p_key, sp, st, rp, loc)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Pelanggan (8 — retail & kredit, tanpa piutang)
-- ---------------------------------------------------------------------------
INSERT INTO customers (id, tenant_id, name, phone, address, type, credit_limit, outstanding_debt)
VALUES
  ((SELECT val FROM _lum WHERE key = 'cust_01'), (SELECT val FROM _lum WHERE key = 'tenant'), 'Pelanggan Umum',              NULL,              NULL,                                    'retail',  0,         0),
  ((SELECT val FROM _lum WHERE key = 'cust_02'), (SELECT val FROM _lum WHERE key = 'tenant'), 'CV Maju Bersama',             '0812-9000-1001', 'Jl. Cut Mutia No. 5, Bekasi',           'credit',  25000000,  0),
  ((SELECT val FROM _lum WHERE key = 'cust_03'), (SELECT val FROM _lum WHERE key = 'tenant'), 'Toko Bangunan Pak Joko',      '0813-9000-1002', 'Jl. Pahlawan No. 22, Jakarta Timur',    'credit',  15000000,  0),
  ((SELECT val FROM _lum WHERE key = 'cust_04'), (SELECT val FROM _lum WHERE key = 'tenant'), 'PT Karya Mandiri Properti',   '021-8899776',    'Kawasan Industri MM2100, Bekasi',       'credit',  75000000,  0),
  ((SELECT val FROM _lum WHERE key = 'cust_05'), (SELECT val FROM _lum WHERE key = 'tenant'), 'Ibu Siti (Renovasi Rumah)',   '0856-9000-1003', 'Perumahan Lumayan Indah Blok C7',       'retail',  0,         0),
  ((SELECT val FROM _lum WHERE key = 'cust_06'), (SELECT val FROM _lum WHERE key = 'tenant'), 'Kontraktor Pak Hendra',       '0817-9000-1004', 'Jl. Basuki Rahmat No. 88',              'credit',  40000000,  0),
  ((SELECT val FROM _lum WHERE key = 'cust_07'), (SELECT val FROM _lum WHERE key = 'tenant'), 'Pak Agus (Proyek Villa)',     '0811-9000-1005', 'Cibubur, Jakarta Timur',                'credit',  30000000,  0),
  ((SELECT val FROM _lum WHERE key = 'cust_08'), (SELECT val FROM _lum WHERE key = 'tenant'), 'Toko Material Sejahtera',     '021-8899778',    'Jl. Raya Bekasi KM 18',                 'credit',  20000000,  0)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Supplier (5 — tanpa hutang)
-- ---------------------------------------------------------------------------
INSERT INTO suppliers (id, tenant_id, name, contact_person, phone, address, email, payment_term_days, outstanding_debt, is_active)
VALUES
  (
    (SELECT val FROM _lum WHERE key = 'sup_01'),
    (SELECT val FROM _lum WHERE key = 'tenant'),
    'PT Semen Indonesia Distributor', 'Pak Wawan', '021-5550101',
    'Jl. Industri Raya No. 12, Cirebon', 'sales@semenindo.co.id', 30, 0, TRUE
  ),
  (
    (SELECT val FROM _lum WHERE key = 'sup_02'),
    (SELECT val FROM _lum WHERE key = 'tenant'),
    'UD Besi Jaya Abadi', 'Bu Yuni', '0812-5550202',
    'Pasar Besi Cakung, Jakarta Timur', 'besijaya@gmail.com', 14, 0, TRUE
  ),
  (
    (SELECT val FROM _lum WHERE key = 'sup_03'),
    (SELECT val FROM _lum WHERE key = 'tenant'),
    'CV Keramik Nusantara', 'Pak Doni', '021-5550303',
    'Kawasan Keramik Cikarang, Bekasi', 'order@keramiknusantara.id', 21, 0, TRUE
  ),
  (
    (SELECT val FROM _lum WHERE key = 'sup_04'),
    (SELECT val FROM _lum WHERE key = 'tenant'),
    'Toko Cat Pro Color', 'Ibu Lina', '0813-5550404',
    'Jl. Gatot Subroto No. 45, Jakarta Selatan', 'proccolor@mail.com', 7, 0, TRUE
  ),
  (
    (SELECT val FROM _lum WHERE key = 'sup_05'),
    (SELECT val FROM _lum WHERE key = 'tenant'),
    'PT Pipa Plastik Sejahtera', 'Pak Rudi', '021-5550505',
    'Kawasan Pergudangan Pulogadung', 'pipa@plastiksejahtera.co.id', 30, 0, TRUE
  )
ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- SES — Neon Phase 1 Seed (demo tenant + users)
-- Password semua user: DemoSES2025!
-- PIN: lihat kolom profiles.pin
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _ids (key TEXT PRIMARY KEY, val UUID);

INSERT INTO _ids VALUES
  ('tenant',        '11111111-0000-0000-0000-000000000001'),
  ('br_sudirman',   '22221111-0000-0000-0000-000000000001'),
  ('br_kebonjeruk', '22221111-0000-0000-0000-000000000002'),
  ('br_bekasi',     '22221111-0000-0000-0000-000000000003'),
  ('u_budi',        '33331111-0000-0000-0000-000000000001'),
  ('u_siti',        '33331111-0000-0000-0000-000000000002'),
  ('u_rudi',        '33331111-0000-0000-0000-000000000003'),
  ('u_andi',        '33331111-0000-0000-0000-000000000004'),
  ('u_dewi',        '33331111-0000-0000-0000-000000000005');

INSERT INTO tenants (id, name, slug, owner_email, phone, plan, is_active, onboarding_complete, legacy_mode_active)
VALUES (
  (SELECT val FROM _ids WHERE key = 'tenant'),
  'Toko Bangunan Simetri',
  'toko-simetri',
  'budi@simetri.id',
  '021-5551234',
  'pro',
  TRUE, TRUE, FALSE
);

INSERT INTO branches (id, tenant_id, code, name, address, phone, is_active)
VALUES
  ((SELECT val FROM _ids WHERE key = 'br_sudirman'), (SELECT val FROM _ids WHERE key = 'tenant'),
   'SDR', 'Cabang Sudirman', 'Jl. Jend. Sudirman No. 45, Jakarta Pusat', '021-5551234', TRUE),
  ((SELECT val FROM _ids WHERE key = 'br_kebonjeruk'), (SELECT val FROM _ids WHERE key = 'tenant'),
   'KBJ', 'Cabang Kebon Jeruk', 'Jl. Kebon Jeruk No. 12, Jakarta Barat', '021-5556789', TRUE),
  ((SELECT val FROM _ids WHERE key = 'br_bekasi'), (SELECT val FROM _ids WHERE key = 'tenant'),
   'BKS', 'Cabang Bekasi', 'Jl. Ahmad Yani No. 88, Bekasi', '021-5559012', TRUE);

INSERT INTO auth_users (id, email, password_hash, tenant_id)
SELECT uid, eml, crypt('DemoSES2025!', gen_salt('bf')), (SELECT val FROM _ids WHERE key = 'tenant')
FROM (VALUES
  ((SELECT val FROM _ids WHERE key = 'u_budi'), 'budi@simetri.id'),
  ((SELECT val FROM _ids WHERE key = 'u_siti'), 'siti@simetri.id'),
  ((SELECT val FROM _ids WHERE key = 'u_rudi'), 'rudi@simetri.id'),
  ((SELECT val FROM _ids WHERE key = 'u_andi'), 'andi@simetri.id'),
  ((SELECT val FROM _ids WHERE key = 'u_dewi'), 'dewi@simetri.id')
) AS t(uid, eml)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, tenant_id, name, email, role, pin, is_active)
VALUES
  ((SELECT val FROM _ids WHERE key = 'u_budi'), (SELECT val FROM _ids WHERE key = 'tenant'),
   'Budi Santoso', 'budi@simetri.id', 'owner', '000000', TRUE),
  ((SELECT val FROM _ids WHERE key = 'u_siti'), (SELECT val FROM _ids WHERE key = 'tenant'),
   'Siti Rahma', 'siti@simetri.id', 'manager', '111111', TRUE),
  ((SELECT val FROM _ids WHERE key = 'u_rudi'), (SELECT val FROM _ids WHERE key = 'tenant'),
   'Rudi Hermawan', 'rudi@simetri.id', 'manager', '555555', TRUE),
  ((SELECT val FROM _ids WHERE key = 'u_andi'), (SELECT val FROM _ids WHERE key = 'tenant'),
   'Andi Pratama', 'andi@simetri.id', 'cashier', '222222', TRUE),
  ((SELECT val FROM _ids WHERE key = 'u_dewi'), (SELECT val FROM _ids WHERE key = 'tenant'),
   'Dewi Lestari', 'dewi@simetri.id', 'warehouse', '333333', TRUE);

INSERT INTO user_branches (user_id, branch_id, tenant_id)
VALUES
  ((SELECT val FROM _ids WHERE key = 'u_budi'), (SELECT val FROM _ids WHERE key = 'br_sudirman'), (SELECT val FROM _ids WHERE key = 'tenant')),
  ((SELECT val FROM _ids WHERE key = 'u_budi'), (SELECT val FROM _ids WHERE key = 'br_kebonjeruk'), (SELECT val FROM _ids WHERE key = 'tenant')),
  ((SELECT val FROM _ids WHERE key = 'u_budi'), (SELECT val FROM _ids WHERE key = 'br_bekasi'), (SELECT val FROM _ids WHERE key = 'tenant')),
  ((SELECT val FROM _ids WHERE key = 'u_siti'), (SELECT val FROM _ids WHERE key = 'br_sudirman'), (SELECT val FROM _ids WHERE key = 'tenant')),
  ((SELECT val FROM _ids WHERE key = 'u_siti'), (SELECT val FROM _ids WHERE key = 'br_kebonjeruk'), (SELECT val FROM _ids WHERE key = 'tenant')),
  ((SELECT val FROM _ids WHERE key = 'u_rudi'), (SELECT val FROM _ids WHERE key = 'br_bekasi'), (SELECT val FROM _ids WHERE key = 'tenant')),
  ((SELECT val FROM _ids WHERE key = 'u_andi'), (SELECT val FROM _ids WHERE key = 'br_sudirman'), (SELECT val FROM _ids WHERE key = 'tenant')),
  ((SELECT val FROM _ids WHERE key = 'u_dewi'), (SELECT val FROM _ids WHERE key = 'br_sudirman'), (SELECT val FROM _ids WHERE key = 'tenant')),
  ((SELECT val FROM _ids WHERE key = 'u_dewi'), (SELECT val FROM _ids WHERE key = 'br_kebonjeruk'), (SELECT val FROM _ids WHERE key = 'tenant'));

COMMIT;

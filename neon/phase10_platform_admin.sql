-- Phase 10 — Platform admin (SES developer / super admin)
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_auth_users_platform_admin
  ON auth_users (is_platform_admin)
  WHERE is_platform_admin = TRUE;

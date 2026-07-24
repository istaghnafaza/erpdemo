-- =============================================================================
-- SES — Phase 6: Google OAuth on auth_users
-- =============================================================================

ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_google_sub_key
  ON auth_users (google_sub)
  WHERE google_sub IS NOT NULL;

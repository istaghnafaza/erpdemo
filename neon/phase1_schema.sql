-- =============================================================================
-- SES — Neon Phase 1 Schema (auth + tenants + branches + users)
-- Run on empty Neon PostgreSQL database.
-- Password demo (bcrypt): DemoSES2025!
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE tenant_plan AS ENUM ('trial', 'basic', 'pro', 'enterprise');
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'cashier', 'warehouse', 'accountant');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Auth (replaces Supabase auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE auth_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  tenant_id     UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER auth_users_updated_at
  BEFORE UPDATE ON auth_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
CREATE TABLE tenants (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  owner_email          TEXT NOT NULL,
  phone                TEXT,
  plan                 tenant_plan NOT NULL DEFAULT 'trial',
  trial_ends_at        TIMESTAMPTZ,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  onboarding_complete  BOOLEAN NOT NULL DEFAULT FALSE,
  legacy_mode_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_tenants_slug ON tenants (slug);

ALTER TABLE auth_users
  ADD CONSTRAINT fk_auth_users_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Branches
-- ---------------------------------------------------------------------------
CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  manager_id  UUID,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX idx_branches_tenant_id ON branches (tenant_id);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth_users (id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'cashier',
  pin         VARCHAR(6),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_profiles_tenant_id ON profiles (tenant_id);
CREATE INDEX idx_profiles_email ON profiles (tenant_id, email);

ALTER TABLE branches
  ADD CONSTRAINT fk_branches_manager
  FOREIGN KEY (manager_id) REFERENCES profiles (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- User ↔ Branch
-- ---------------------------------------------------------------------------
CREATE TABLE user_branches (
  user_id    UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  branch_id  UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, branch_id)
);

CREATE INDEX idx_user_branches_tenant_id ON user_branches (tenant_id);
CREATE INDEX idx_user_branches_branch_id ON user_branches (branch_id);

-- Phase 9: username login (opsional — backfill dari bagian lokal email)
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS username varchar(32);

-- Backfill username dari email untuk akun yang sudah ada (owner → owner@...)
UPDATE auth_users
SET username = lower(split_part(email, '@', 1))
WHERE username IS NULL
  AND email IS NOT NULL
  AND email LIKE '%@%';

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_username_unique
  ON auth_users (lower(username))
  WHERE username IS NOT NULL;

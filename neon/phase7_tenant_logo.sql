-- Phase 7: tenant branding (logo URL for Toko Saya)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url text;

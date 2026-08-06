-- Pengaturan rekening transfer & QRIS per cabang (POS checkout)
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS payment_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

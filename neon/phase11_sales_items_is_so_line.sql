-- Baris Sales Order (indent) di struk POS — tidak kurangi stok toko saat checkout
ALTER TABLE sales_items
  ADD COLUMN IF NOT EXISTS is_so_line BOOLEAN NOT NULL DEFAULT false;

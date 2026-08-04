-- PO status: menunggu konfirmasi supplier (indent dari SO)
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'awaiting_supplier' BEFORE 'sent';

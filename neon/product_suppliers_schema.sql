-- Product ↔ Supplier links (many-to-many)
CREATE TABLE IF NOT EXISTS product_suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  supplier_id   UUID NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  is_preferred  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON product_suppliers (tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier ON product_suppliers (tenant_id, supplier_id);

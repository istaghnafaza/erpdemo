-- Sprint 4 P1-6: composite index for branch_products tenant + branch lookups
CREATE INDEX IF NOT EXISTS idx_branch_products_tenant_branch
  ON branch_products (tenant_id, branch_id);

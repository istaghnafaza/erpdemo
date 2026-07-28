-- Phase 8 — RLS defense-in-depth (optional; requires non-owner DB role + SET app.current_tenant_id)
-- Apply only when using restricted role `seps_app` instead of table owner.
-- App code: run SET LOCAL app.current_tenant_id before queries via withTenantContext().

-- Example (uncomment when role is ready):
-- ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY sales_tx_tenant ON sales_transactions
--   USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

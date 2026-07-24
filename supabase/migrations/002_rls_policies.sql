-- =============================================================================
-- SES (Simetri ERP Store) — Granular RLS Policies
-- Version: 002
-- Description: Per-operation RLS policies with RBAC enforcement.
--              Drops the coarse FOR ALL policies from 001 and replaces them
--              with fine-grained SELECT / INSERT / UPDATE / DELETE policies.
-- Run AFTER: 001_initial_schema.sql
-- =============================================================================


-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- get_user_role(): returns the role of the currently authenticated user
--   by looking up profiles using auth.uid().
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- get_user_tenant_id(): returns the tenant_id of the current user from profiles.
--   Falls back to JWT claim as a second source.
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1),
    get_current_tenant_id()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- is_owner(): true when current user has role 'owner'
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'owner';
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- is_owner_or_manager(): true when current user is owner or manager
CREATE OR REPLACE FUNCTION is_owner_or_manager()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('owner', 'manager');
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- is_cashier(): true when current user has role 'cashier'
CREATE OR REPLACE FUNCTION is_cashier()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'cashier';
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- is_warehouse(): true when current user has role 'warehouse'
CREATE OR REPLACE FUNCTION is_warehouse()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'warehouse';
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- is_accountant(): true when current user has role 'accountant'
CREATE OR REPLACE FUNCTION is_accountant()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'accountant';
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- can_access_tenant(t UUID): true when the given tenant_id matches the
--   current user's tenant, or the user is a super admin.
CREATE OR REPLACE FUNCTION can_access_tenant(t UUID)
RETURNS BOOLEAN AS $$
  SELECT is_super_admin() OR t = get_user_tenant_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- =============================================================================
-- STEP 1: Drop the coarse FOR ALL policies from migration 001
-- =============================================================================
DO $drop_policies$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'tenants','branches','profiles','user_branches',
    'product_categories','products','branch_products',
    'cashier_sessions','pos_carts','customers',
    'sales_transactions','sales_items',
    'stock_movements','stock_transfers','stock_transfer_items',
    'suppliers','purchase_orders','purchase_order_items',
    'goods_receipts','goods_receipt_items',
    'sales_orders','sales_order_items','so_fulfillments',
    'cash_accounts','cash_transactions',
    'accounts_receivable','ar_payments',
    'accounts_payable','ap_payments',
    'offline_tx_queue','reconciliation_alerts','reconciliation_alert_items'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      tbl || '_isolation', tbl
    );
  END LOOP;
END;
$drop_policies$;


-- =============================================================================
-- TENANTS
-- Owners/super admins can see their tenant; super admin can see all.
-- =============================================================================
CREATE POLICY tenants_select ON tenants FOR SELECT
  USING (is_super_admin() OR id = get_user_tenant_id());

CREATE POLICY tenants_insert ON tenants FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY tenants_update ON tenants FOR UPDATE
  USING (is_super_admin() OR (id = get_user_tenant_id() AND is_owner()));

CREATE POLICY tenants_delete ON tenants FOR DELETE
  USING (is_super_admin());


-- =============================================================================
-- BRANCHES
-- All authenticated users in the tenant can SELECT.
-- Only owner can INSERT / DELETE; owner+manager can UPDATE.
-- =============================================================================
CREATE POLICY branches_select ON branches FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY branches_insert ON branches FOR INSERT
  WITH CHECK (can_access_tenant(tenant_id) AND is_owner());

CREATE POLICY branches_update ON branches FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY branches_delete ON branches FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- PROFILES
-- SELECT: any authenticated user in the same tenant.
-- INSERT: only owner (create staff) or super_admin.
-- UPDATE: user can update their own profile; owner can update anyone.
-- DELETE: only owner (soft-delete preferred: set is_active=false).
-- =============================================================================
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_super_admin() OR is_owner())
  );

CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (
      id = auth.uid()          -- own profile
      OR is_super_admin()
      OR is_owner()
    )
  );

CREATE POLICY profiles_delete ON profiles FOR DELETE
  USING (can_access_tenant(tenant_id) AND (is_super_admin() OR is_owner()));


-- =============================================================================
-- USER_BRANCHES
-- All tenant members can SELECT. Only owner can manage assignments.
-- =============================================================================
CREATE POLICY user_branches_select ON user_branches FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY user_branches_insert ON user_branches FOR INSERT
  WITH CHECK (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY user_branches_update ON user_branches FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner());

CREATE POLICY user_branches_delete ON user_branches FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- PRODUCT_CATEGORIES
-- All users SELECT. Owner/manager INSERT/UPDATE. Owner only DELETE.
-- =============================================================================
CREATE POLICY product_categories_select ON product_categories FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY product_categories_insert ON product_categories FOR INSERT
  WITH CHECK (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY product_categories_update ON product_categories FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY product_categories_delete ON product_categories FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- PRODUCTS (master katalog, terpusat per tenant)
-- All users SELECT (cashier needs to read products during POS).
-- INSERT/UPDATE: only owner and manager.
-- DELETE (soft delete via is_active): only owner.
-- =============================================================================
CREATE POLICY products_select ON products FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY products_insert ON products FOR INSERT
  WITH CHECK (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY products_update ON products FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY products_delete ON products FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- BRANCH_PRODUCTS (stok & harga jual per cabang)
-- SELECT: all users.
-- INSERT: owner/manager.
-- UPDATE selling_price: owner/manager only.
-- UPDATE stock: warehouse, manager, owner (handled at app layer for stock column).
--   At DB level we allow owner/manager/warehouse to UPDATE any column.
-- DELETE: owner only.
-- =============================================================================
CREATE POLICY branch_products_select ON branch_products FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY branch_products_insert ON branch_products FOR INSERT
  WITH CHECK (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY branch_products_update ON branch_products FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (is_owner_or_manager() OR is_warehouse())
  );

CREATE POLICY branch_products_delete ON branch_products FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- CASHIER_SESSIONS
-- SELECT: everyone in tenant.
-- INSERT (open session): cashier, manager, owner.
-- UPDATE (close session): the session's own cashier, manager, owner.
-- DELETE: owner only.
-- =============================================================================
CREATE POLICY cashier_sessions_select ON cashier_sessions FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY cashier_sessions_insert ON cashier_sessions FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_cashier() OR is_owner_or_manager())
  );

CREATE POLICY cashier_sessions_update ON cashier_sessions FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (cashier_id = auth.uid() OR is_owner_or_manager())
  );

CREATE POLICY cashier_sessions_delete ON cashier_sessions FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- POS_CARTS
-- SELECT: creator or manager/owner.
-- INSERT: cashier, manager, owner.
-- UPDATE: creator or manager/owner.
-- DELETE: manager/owner only (cancel cart).
-- =============================================================================
CREATE POLICY pos_carts_select ON pos_carts FOR SELECT
  USING (
    can_access_tenant(tenant_id)
    AND (cashier_id = auth.uid() OR is_owner_or_manager())
  );

CREATE POLICY pos_carts_insert ON pos_carts FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_cashier() OR is_owner_or_manager())
  );

CREATE POLICY pos_carts_update ON pos_carts FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (cashier_id = auth.uid() OR is_owner_or_manager())
  );

CREATE POLICY pos_carts_delete ON pos_carts FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());


-- =============================================================================
-- CUSTOMERS
-- SELECT: all users (cashier needs during POS).
-- INSERT/UPDATE: cashier, manager, owner (anyone can add/edit customer).
-- DELETE: owner only.
-- =============================================================================
CREATE POLICY customers_select ON customers FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY customers_insert ON customers FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_cashier() OR is_owner_or_manager())
  );

CREATE POLICY customers_update ON customers FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (is_cashier() OR is_owner_or_manager())
  );

CREATE POLICY customers_delete ON customers FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- SALES_TRANSACTIONS
-- SELECT: all users in tenant.
-- INSERT: cashier, manager, owner (anyone who handles POS).
-- UPDATE (void/return): manager, owner — NOT cashier.
-- DELETE: owner only (rare; prefer status='voided').
-- =============================================================================
CREATE POLICY sales_transactions_select ON sales_transactions FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY sales_transactions_insert ON sales_transactions FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_cashier() OR is_owner_or_manager())
  );

CREATE POLICY sales_transactions_update ON sales_transactions FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND is_owner_or_manager()   -- kasir TIDAK bisa void transaksi
  );

CREATE POLICY sales_transactions_delete ON sales_transactions FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- SALES_ITEMS
-- SELECT: all. INSERT: cashier/manager/owner (created with transaction).
-- UPDATE/DELETE: owner/manager (correction only).
-- =============================================================================
CREATE POLICY sales_items_select ON sales_items FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY sales_items_insert ON sales_items FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_cashier() OR is_owner_or_manager())
  );

CREATE POLICY sales_items_update ON sales_items FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY sales_items_delete ON sales_items FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- STOCK_MOVEMENTS (append-only log — no UPDATE/DELETE in production)
-- SELECT: all users in tenant.
-- INSERT: warehouse, manager, owner.
-- UPDATE: owner only (correction).
-- DELETE: owner only (irreversible — prefer audit trail).
-- =============================================================================
CREATE POLICY stock_movements_select ON stock_movements FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY stock_movements_insert ON stock_movements FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_warehouse() OR is_owner_or_manager())
  );

CREATE POLICY stock_movements_update ON stock_movements FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner());

CREATE POLICY stock_movements_delete ON stock_movements FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- STOCK_TRANSFERS
-- SELECT: all users.
-- INSERT: warehouse, manager, owner.
-- UPDATE: manager, owner (confirm/cancel).
-- DELETE: owner only.
-- =============================================================================
CREATE POLICY stock_transfers_select ON stock_transfers FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY stock_transfers_insert ON stock_transfers FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_warehouse() OR is_owner_or_manager())
  );

CREATE POLICY stock_transfers_update ON stock_transfers FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (is_warehouse() OR is_owner_or_manager())
  );

CREATE POLICY stock_transfers_delete ON stock_transfers FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- STOCK_TRANSFER_ITEMS
-- Same permission as stock_transfers.
-- =============================================================================
CREATE POLICY stock_transfer_items_select ON stock_transfer_items FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY stock_transfer_items_insert ON stock_transfer_items FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_warehouse() OR is_owner_or_manager())
  );

CREATE POLICY stock_transfer_items_update ON stock_transfer_items FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (is_warehouse() OR is_owner_or_manager())
  );

CREATE POLICY stock_transfer_items_delete ON stock_transfer_items FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- SUPPLIERS
-- SELECT: all except cashier.
-- INSERT/UPDATE: owner/manager.
-- DELETE: owner only.
-- =============================================================================
CREATE POLICY suppliers_select ON suppliers FOR SELECT
  USING (can_access_tenant(tenant_id) AND NOT is_cashier());

CREATE POLICY suppliers_insert ON suppliers FOR INSERT
  WITH CHECK (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY suppliers_update ON suppliers FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY suppliers_delete ON suppliers FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- PURCHASE_ORDERS
-- SELECT: all except cashier.
-- INSERT: all except cashier and accountant (warehouse/manager/owner).
-- UPDATE status: manager, owner only.
-- DELETE: owner only.
-- =============================================================================
CREATE POLICY purchase_orders_select ON purchase_orders FOR SELECT
  USING (can_access_tenant(tenant_id) AND NOT is_cashier());

CREATE POLICY purchase_orders_insert ON purchase_orders FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_warehouse() OR is_owner_or_manager())
  );

CREATE POLICY purchase_orders_update ON purchase_orders FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND is_owner_or_manager()
  );

CREATE POLICY purchase_orders_delete ON purchase_orders FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- PURCHASE_ORDER_ITEMS
-- Same visibility as purchase_orders.
-- =============================================================================
CREATE POLICY po_items_select ON purchase_order_items FOR SELECT
  USING (can_access_tenant(tenant_id) AND NOT is_cashier());

CREATE POLICY po_items_insert ON purchase_order_items FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_warehouse() OR is_owner_or_manager())
  );

CREATE POLICY po_items_update ON purchase_order_items FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY po_items_delete ON purchase_order_items FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- GOODS_RECEIPTS
-- SELECT: all except cashier. INSERT: warehouse/manager/owner.
-- UPDATE/DELETE: manager/owner.
-- =============================================================================
CREATE POLICY goods_receipts_select ON goods_receipts FOR SELECT
  USING (can_access_tenant(tenant_id) AND NOT is_cashier());

CREATE POLICY goods_receipts_insert ON goods_receipts FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_warehouse() OR is_owner_or_manager())
  );

CREATE POLICY goods_receipts_update ON goods_receipts FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY goods_receipts_delete ON goods_receipts FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- GOODS_RECEIPT_ITEMS — same as goods_receipts
-- =============================================================================
CREATE POLICY gr_items_select ON goods_receipt_items FOR SELECT
  USING (can_access_tenant(tenant_id) AND NOT is_cashier());

CREATE POLICY gr_items_insert ON goods_receipt_items FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_warehouse() OR is_owner_or_manager())
  );

CREATE POLICY gr_items_update ON goods_receipt_items FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY gr_items_delete ON goods_receipt_items FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- SALES_ORDERS
-- SELECT: all. INSERT: cashier/manager/owner (SO from POS or sales desk).
-- UPDATE: manager/owner (status changes).
-- DELETE: owner only.
-- =============================================================================
CREATE POLICY sales_orders_select ON sales_orders FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY sales_orders_insert ON sales_orders FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_cashier() OR is_owner_or_manager())
  );

CREATE POLICY sales_orders_update ON sales_orders FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY sales_orders_delete ON sales_orders FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- SALES_ORDER_ITEMS — same as sales_orders
-- =============================================================================
CREATE POLICY so_items_select ON sales_order_items FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY so_items_insert ON sales_order_items FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_cashier() OR is_owner_or_manager())
  );

CREATE POLICY so_items_update ON sales_order_items FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY so_items_delete ON sales_order_items FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- SO_FULFILLMENTS — managed by manager/owner/warehouse
-- =============================================================================
CREATE POLICY so_fulfillments_select ON so_fulfillments FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY so_fulfillments_insert ON so_fulfillments FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_warehouse() OR is_owner_or_manager())
  );

CREATE POLICY so_fulfillments_update ON so_fulfillments FOR UPDATE
  USING (can_access_tenant(tenant_id) AND (is_warehouse() OR is_owner_or_manager()));

CREATE POLICY so_fulfillments_delete ON so_fulfillments FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- CASH_ACCOUNTS
-- SELECT: all except cashier (cashier sees only session cash, not full accounts).
-- INSERT/UPDATE: owner/accountant only.
-- DELETE: owner only.
-- =============================================================================
CREATE POLICY cash_accounts_select ON cash_accounts FOR SELECT
  USING (can_access_tenant(tenant_id) AND NOT is_cashier());

CREATE POLICY cash_accounts_insert ON cash_accounts FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_owner() OR is_accountant())
  );

CREATE POLICY cash_accounts_update ON cash_accounts FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (is_owner() OR is_accountant())
  );

CREATE POLICY cash_accounts_delete ON cash_accounts FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- CASH_TRANSACTIONS
-- SELECT: all except cashier.
-- INSERT: owner/manager/accountant.
-- UPDATE/DELETE: owner/accountant only.
-- =============================================================================
CREATE POLICY cash_transactions_select ON cash_transactions FOR SELECT
  USING (can_access_tenant(tenant_id) AND NOT is_cashier());

CREATE POLICY cash_transactions_insert ON cash_transactions FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_owner() OR is_owner_or_manager() OR is_accountant())
  );

CREATE POLICY cash_transactions_update ON cash_transactions FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (is_owner() OR is_accountant())
  );

CREATE POLICY cash_transactions_delete ON cash_transactions FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- ACCOUNTS_RECEIVABLE
-- SELECT: all except cashier (cashier doesn't manage credit).
-- INSERT: cashier/manager/owner (created at point of credit sale).
-- UPDATE: manager/owner/accountant.
-- DELETE: owner only.
-- =============================================================================
CREATE POLICY ar_select ON accounts_receivable FOR SELECT
  USING (can_access_tenant(tenant_id) AND NOT is_cashier());

CREATE POLICY ar_insert ON accounts_receivable FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_cashier() OR is_owner_or_manager() OR is_accountant())
  );

CREATE POLICY ar_update ON accounts_receivable FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (is_owner_or_manager() OR is_accountant())
  );

CREATE POLICY ar_delete ON accounts_receivable FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- AR_PAYMENTS — same visibility as AR
-- =============================================================================
CREATE POLICY ar_payments_select ON ar_payments FOR SELECT
  USING (can_access_tenant(tenant_id) AND NOT is_cashier());

CREATE POLICY ar_payments_insert ON ar_payments FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_owner_or_manager() OR is_accountant())
  );

CREATE POLICY ar_payments_update ON ar_payments FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (is_owner() OR is_accountant())
  );

CREATE POLICY ar_payments_delete ON ar_payments FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- ACCOUNTS_PAYABLE — hidden from cashier
-- =============================================================================
CREATE POLICY ap_select ON accounts_payable FOR SELECT
  USING (can_access_tenant(tenant_id) AND NOT is_cashier());

CREATE POLICY ap_insert ON accounts_payable FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_owner_or_manager() OR is_accountant())
  );

CREATE POLICY ap_update ON accounts_payable FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (is_owner_or_manager() OR is_accountant())
  );

CREATE POLICY ap_delete ON accounts_payable FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- AP_PAYMENTS — same as AP
-- =============================================================================
CREATE POLICY ap_payments_select ON ap_payments FOR SELECT
  USING (can_access_tenant(tenant_id) AND NOT is_cashier());

CREATE POLICY ap_payments_insert ON ap_payments FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_owner_or_manager() OR is_accountant())
  );

CREATE POLICY ap_payments_update ON ap_payments FOR UPDATE
  USING (
    can_access_tenant(tenant_id)
    AND (is_owner() OR is_accountant())
  );

CREATE POLICY ap_payments_delete ON ap_payments FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- OFFLINE_TX_QUEUE — device-level, managed by app service role mostly
-- SELECT: cashier/manager/owner.
-- INSERT: cashier/manager/owner (offline device writes here).
-- UPDATE (sync_status): manager/owner or service role.
-- DELETE: manager/owner after sync confirmed.
-- =============================================================================
CREATE POLICY offline_queue_select ON offline_tx_queue FOR SELECT
  USING (
    can_access_tenant(tenant_id)
    AND (is_cashier() OR is_owner_or_manager())
  );

CREATE POLICY offline_queue_insert ON offline_tx_queue FOR INSERT
  WITH CHECK (
    can_access_tenant(tenant_id)
    AND (is_cashier() OR is_owner_or_manager())
  );

CREATE POLICY offline_queue_update ON offline_tx_queue FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY offline_queue_delete ON offline_tx_queue FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());


-- =============================================================================
-- RECONCILIATION_ALERTS — internal audit tool, manager+ only
-- =============================================================================
CREATE POLICY recon_alerts_select ON reconciliation_alerts FOR SELECT
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY recon_alerts_insert ON reconciliation_alerts FOR INSERT
  WITH CHECK (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY recon_alerts_update ON reconciliation_alerts FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY recon_alerts_delete ON reconciliation_alerts FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- RECONCILIATION_ALERT_ITEMS — same as alerts
-- =============================================================================
CREATE POLICY recon_items_select ON reconciliation_alert_items FOR SELECT
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY recon_items_insert ON reconciliation_alert_items FOR INSERT
  WITH CHECK (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY recon_items_update ON reconciliation_alert_items FOR UPDATE
  USING (can_access_tenant(tenant_id) AND is_owner_or_manager());

CREATE POLICY recon_items_delete ON reconciliation_alert_items FOR DELETE
  USING (can_access_tenant(tenant_id) AND is_owner());


-- =============================================================================
-- END OF MIGRATION 002
-- =============================================================================

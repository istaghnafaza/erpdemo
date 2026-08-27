// =============================================================================
// SES Database Types — snake_case, mirrors PostgreSQL schema exactly.
// These are the "raw" types coming from / going to Supabase.
// Do NOT use these directly in UI components — use app.ts types instead.
// =============================================================================

// ---------------------------------------------------------------------------
// Enum literals (mirrored from SQL enums in 001_initial_schema.sql)
// ---------------------------------------------------------------------------
export type DbTenantPlan       = 'trial' | 'basic' | 'pro' | 'enterprise';
export type DbUserRole         = 'owner' | 'manager' | 'cashier' | 'warehouse' | 'accountant';
export type DbSessionStatus    = 'open' | 'closed';
export type DbCartStatus       = 'active' | 'hold' | 'paid' | 'cancelled';
export type DbCustomerType     = 'retail' | 'credit';
export type DbPaymentMethod    = 'cash' | 'card' | 'qris_edc' | 'qris_gopay' | 'qris_ovo' | 'qris_other' | 'transfer' | 'credit';
export type DbArPaymentMethod  = 'cash' | 'transfer';
export type DbTxStatus         = 'completed' | 'voided' | 'returned';
export type DbStockSource      = 'verified' | 'legacy' | 'unverified';
export type DbStockStatus      = 'new' | 'unverified' | 'verified';
export type DbStockOwnership   = 'owned' | 'consignment';
export type DbPoOwnership      = 'owned' | 'consignment';
export type DbPoPayTrigger     = 'on_receipt_credit' | 'on_receipt_cash' | 'on_sale';
export type DbMovementType     = 'in' | 'out' | 'adjustment' | 'opname' | 'transfer_out' | 'transfer_in' | 'legacy_in' | 'legacy_out';
export type DbTransferStatus   = 'draft' | 'sent' | 'received' | 'cancelled';
export type DbPoType           = 'regular' | 'indent';
export type DbPoStatus         = 'draft' | 'awaiting_supplier' | 'sent' | 'partial_received' | 'received' | 'cancelled';
export type DbSoStatus         = 'draft' | 'confirmed' | 'partial_delivered' | 'completed' | 'cancelled';
export type DbSoPaymentStatus  = 'unpaid' | 'partial' | 'paid';
export type DbSoItemStatus     = 'pending' | 'partial' | 'fulfilled';
export type DbFulfillmentSrc   = 'stock' | 'indent';
export type DbFulfillmentStatus= 'planned' | 'in_progress' | 'delivered';
export type DbAccountType      = 'cash' | 'bank';
export type DbCashTxType       = 'income' | 'expense' | 'transfer';
export type DbOwnerCapitalKind = 'prive_keluar' | 'setoran_owner';
export type DbArStatus         = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type DbApStatus         = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type DbSyncStatus       = 'pending' | 'syncing' | 'synced' | 'failed';
export type DbOfflineFlag      = 'STOCK_DEFICIT' | 'CREDIT_EXCEEDED' | 'PRICE_CHANGED';
export type DbReconcileFlag    = 'STOCK_DEFICIT' | 'CREDIT_EXCEEDED' | 'PRICE_CHANGED';


// ---------------------------------------------------------------------------
// 1. Tenant
// ---------------------------------------------------------------------------
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  phone: string | null;
  plan: DbTenantPlan;
  trial_ends_at: string | null;
  plan_renews_at: string | null;
  is_active: boolean;
  onboarding_complete: boolean;
  legacy_mode_active: boolean;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export type TenantInsert = Omit<Tenant, 'id' | 'created_at' | 'updated_at'> & { id?: string };
export type TenantUpdate = Partial<TenantInsert>;


// ---------------------------------------------------------------------------
// 2. Branch
// ---------------------------------------------------------------------------
export interface Branch {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  manager_id: string | null;
  is_active: boolean;
  payment_settings: import("@/types/payment-settings").BranchPaymentSettings;
  created_at: string;
}

export type BranchInsert = Omit<Branch, 'id' | 'created_at'> & { id?: string };
export type BranchUpdate = Partial<BranchInsert>;


// ---------------------------------------------------------------------------
// 3. Profile (extends auth.users — Supabase convention)
// ---------------------------------------------------------------------------
export interface Profile {
  id: string;          // FK → auth.users.id
  tenant_id: string;
  name: string;
  email: string;
  role: DbUserRole;
  pin: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>;
export type ProfileUpdate = Partial<Omit<ProfileInsert, 'id' | 'tenant_id'>>;


// ---------------------------------------------------------------------------
// 4. UserBranch (many-to-many)
// ---------------------------------------------------------------------------
export interface UserBranch {
  user_id: string;
  branch_id: string;
  tenant_id: string;
}


// ---------------------------------------------------------------------------
// 5. ProductCategory
// ---------------------------------------------------------------------------
export interface ProductCategory {
  id: string;
  tenant_id: string;
  name: string;
  icon: string | null;
  created_at: string;
}

export type ProductCategoryInsert = Omit<ProductCategory, 'id' | 'created_at'> & { id?: string };
export type ProductCategoryUpdate = Partial<ProductCategoryInsert>;


// ---------------------------------------------------------------------------
// 6. Product (master katalog, terpusat per tenant)
// ---------------------------------------------------------------------------
export interface Product {
  id: string;
  tenant_id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category_id: string | null;
  unit: string;
  /** Satuan dasar stok; default = unit bila null. */
  stock_unit?: string | null;
  purchase_price: number;   // integer — IDR rupiah
  is_returnable: boolean;
  return_block_label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Diisi saat join / load catalog multi-unit. */
  sell_units?: import("@/lib/product-sell-units").ProductSellUnit[];
}

export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at'> & { id?: string };
export type ProductUpdate = Partial<Omit<ProductInsert, 'tenant_id'>>;


// ---------------------------------------------------------------------------
// 7. BranchProduct (stok & harga per cabang)
// ---------------------------------------------------------------------------
export interface BranchProduct {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  selling_price: number;    // integer — IDR rupiah
  stock: number;
  legacy_stock: number;
  stock_status: DbStockStatus;
  stock_ownership: DbStockOwnership;
  consignment_supplier_id: string | null;
  reorder_point: number;
  warehouse_location: string | null;
}

export type BranchProductInsert = Omit<BranchProduct, 'id'> & { id?: string };
export type BranchProductUpdate = Partial<Omit<BranchProductInsert, 'tenant_id' | 'branch_id' | 'product_id'>>;

/** Joined: product master + branch-specific data */
export interface BranchProductWithProduct extends BranchProduct {
  product: Product;
  /** Harga beli baris PO owned terbaru (bukan HPP rata-rata). */
  last_po_price?: number | null;
  last_po_number?: string | null;
}


// ---------------------------------------------------------------------------
// 8. CashierSession
// ---------------------------------------------------------------------------
export interface CashierSession {
  id: string;
  tenant_id: string;
  branch_id: string;
  cashier_id: string;
  status: DbSessionStatus;
  opened_at: string;
  closed_at: string | null;
  opening_cash_balance: number;
  expected_cash_balance: number;
  actual_cash_balance: number | null;
  cash_discrepancy: number | null;   // GENERATED ALWAYS AS STORED
  total_sales: number;
  total_cash_sales: number;
  total_card_sales: number;
  total_transfer_sales: number;
  total_credit_sales: number;
  total_transactions: number;
  notes: string | null;
}

export type CashierSessionInsert = Omit<
  CashierSession,
  'id' | 'cash_discrepancy' | 'expected_cash_balance' | 'total_sales' |
  'total_cash_sales' | 'total_card_sales' | 'total_transfer_sales' |
  'total_credit_sales' | 'total_transactions'
> & {
  closed_at?: string | null;
  actual_cash_balance?: number | null;
  notes?: string | null;
};
export type CashierSessionClose = Pick<
  CashierSession,
  'status' | 'closed_at' | 'actual_cash_balance' | 'notes'
>;


// ---------------------------------------------------------------------------
// 9. PosCart
// ---------------------------------------------------------------------------
export interface PosCart {
  id: string;
  tenant_id: string;
  branch_id: string;
  session_id: string;
  cashier_id: string;
  cart_number: number;      // 1–5
  customer_name: string | null;
  customer_id: string | null;
  discount_percent: number;
  notes: string | null;
  status: DbCartStatus;
  created_at: string;
  updated_at: string;
}

export type PosCartInsert = Omit<PosCart, 'id' | 'created_at' | 'updated_at'> & { id?: string };
export type PosCartUpdate = Partial<Omit<PosCartInsert, 'tenant_id' | 'branch_id' | 'session_id'>>;

/** Frontend-only: a line item inside an active cart (not a DB table) */
export interface CartItem {
  product_id: string;
  branch_product_id: string;
  sku: string;
  name: string;
  unit: string;
  qty: number;
  selling_price: number;
  purchase_price: number;
  discount: number;         // per-item discount in rupiah
  subtotal: number;
  stock_source: DbStockSource;
  available_stock: number;  // for real-time validation (satuan dasar)
  /** Barang di-fulfill via Sales Order (indent) — tidak kurangi stok saat checkout POS */
  is_so_line?: boolean;
  /** Harga cabang sebelum diskon tier */
  base_selling_price?: number;
  category_id?: string | null;
  volume_tier_code?: string | null;
  volume_discount_percent?: number;
  customer_discount_percent?: number;
  floor_price?: number;
  pricing_clamped?: boolean;
  /** Diskon tier dibatasi margin min barang ini (anti rugi). */
  pricing_margin_limited?: boolean;
  price_override?: { unit_price: number; reason: string } | null;
  /** Multi-unit: satuan jual terpilih */
  sell_unit_id?: string | null;
  sell_unit_label?: string | null;
  factor_to_base?: number;
  /** qty × factor — potongan stok dasar */
  qty_base?: number;
  allow_fraction?: boolean;
  preset_qty?: number[];
  stock_unit?: string;
}


// ---------------------------------------------------------------------------
// 10. Customer
// ---------------------------------------------------------------------------
export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  type: DbCustomerType;
  credit_limit: number;
  outstanding_debt: number;
  created_at: string;
  /** Tier harga pelanggan (P0–P4) */
  pricing_tier_id?: string | null;
}

export type CustomerInsert = Omit<Customer, 'id' | 'created_at'> & { id?: string };
export type CustomerUpdate = Partial<Omit<CustomerInsert, 'tenant_id'>>;


// ---------------------------------------------------------------------------
// 11. SalesTransaction
// ---------------------------------------------------------------------------
export interface SalesTransaction {
  id: string;
  tenant_id: string;
  branch_id: string;
  session_id: string;
  cart_id: string | null;
  transaction_number: string;
  customer_id: string | null;
  customer_name: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  payment_method: DbPaymentMethod;
  qris_provider: string | null;
  amount_paid: number;
  change_amount: number;
  input_by: string | null;
  paid_by: string | null;
  is_cross_session: boolean;
  has_legacy_items: boolean;
  is_offline_transaction: boolean;
  offline_created_at: string | null;
  sync_status: DbSyncStatus;
  status: DbTxStatus;
  return_status: "none" | "partial" | "full";
  return_offset_amount: number;
  linked_return_id: string | null;
  notes: string | null;
  client_tx_id?: string | null;
  created_at: string;
}

export type SalesTransactionInsert = Omit<SalesTransaction, 'id' | 'created_at'> & { id?: string; created_at?: string };


// ---------------------------------------------------------------------------
// 12. SalesItem
// ---------------------------------------------------------------------------
export interface SalesItem {
  id: string;
  transaction_id: string;
  tenant_id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  unit: string;
  qty: number;
  purchase_price: number;
  selling_price: number;
  discount: number;
  subtotal: number;
  stock_source: DbStockSource;
  /** Baris indent/SO — tidak kurangi stok toko saat checkout POS */
  is_so_line?: boolean;
  qty_returned: number;
  sell_unit_id?: string | null;
  sell_unit_label?: string | null;
  qty_base?: number | null;
  factor_to_base?: number | null;
}

export type SalesItemInsert = Omit<SalesItem, 'id' | 'transaction_id'> & { id?: string; transaction_id?: string };


// ---------------------------------------------------------------------------
// 13. StockMovement
// ---------------------------------------------------------------------------
export interface StockMovement {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  type: DbMovementType;
  stock_source: DbStockSource;
  qty: number;
  qty_before: number;
  qty_after: number;
  reference: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
}

export type StockMovementInsert = Omit<StockMovement, 'id' | 'created_at'> & { id?: string; created_at?: string };


// ---------------------------------------------------------------------------
// 14. StockTransfer
// ---------------------------------------------------------------------------
export interface StockTransfer {
  id: string;
  tenant_id: string;
  transfer_number: string;
  from_branch_id: string;
  to_branch_id: string;
  status: DbTransferStatus;
  notes: string | null;
  created_by: string | null;
  confirmed_by: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
}

export type StockTransferInsert = Omit<StockTransfer, 'id' | 'created_at'> & { id?: string };
export type StockTransferUpdate = Partial<Pick<StockTransfer,
  'status' | 'notes' | 'confirmed_by' | 'sent_at' | 'received_at'
>>;


// ---------------------------------------------------------------------------
// 15. StockTransferItem
// ---------------------------------------------------------------------------
export interface StockTransferItem {
  id: string;
  transfer_id: string;
  tenant_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  unit: string;
  requested_qty: number;
  sent_qty: number;
  received_qty: number;
}

export type StockTransferItemInsert = Omit<StockTransferItem, 'id'> & { id?: string };


// ---------------------------------------------------------------------------
// StockOpname (frontend model — recorded as StockMovements with type='opname')
// ---------------------------------------------------------------------------
export interface StockOpname {
  id: string;             // maps to a batch reference in stock_movements
  tenant_id: string;
  branch_id: string;
  reference: string;      // e.g. "OPNAME-20250115"
  conducted_by: string;   // user_id
  notes: string | null;
  created_at: string;
  items: OpnameItem[];
}

export interface OpnameItem {
  product_id: string;
  sku: string;
  product_name: string;
  unit: string;
  system_stock: number;
  actual_stock: number;
  discrepancy: number;    // actual - system
  stock_source: DbStockSource;
  notes: string | null;
}


// ---------------------------------------------------------------------------
// 16. Supplier
// ---------------------------------------------------------------------------
export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  payment_term_days: number;
  outstanding_debt: number;
  is_active: boolean;
}

export type SupplierInsert = Omit<Supplier, 'id'> & { id?: string };
export type SupplierUpdate = Partial<Omit<SupplierInsert, 'tenant_id'>>;

export interface ProductSupplier {
  id: string;
  tenant_id: string;
  product_id: string;
  supplier_id: string;
  is_preferred: boolean;
  last_purchase_price: number;
}

export type SupplierWithProducts = Supplier & { product_ids: string[] };


// ---------------------------------------------------------------------------
// 17. PurchaseOrder
// ---------------------------------------------------------------------------
export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  branch_id: string;
  po_number: string;
  type: DbPoType;
  ownership_mode: DbPoOwnership;
  pay_trigger: DbPoPayTrigger;
  discount_amount: number;
  rebate_after_qty: number | null;
  rebate_per_unit: number;
  consignment_sold_qty: number;
  sales_order_id: string | null;
  supplier_id: string;
  delivery_address: string | null;
  subtotal: number;
  grand_total: number;
  status: DbPoStatus;
  expected_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type PurchaseOrderInsert = Omit<PurchaseOrder, 'id' | 'created_at'> & { id?: string };
export type PurchaseOrderUpdate = Partial<Pick<PurchaseOrder,
  'status' | 'expected_date' | 'delivery_address' | 'notes' | 'subtotal' | 'grand_total' |
  'ownership_mode' | 'pay_trigger' | 'discount_amount' | 'rebate_after_qty' | 'rebate_per_unit'
>>;


// ---------------------------------------------------------------------------
// 18. PoItem (PurchaseOrderItem)
// ---------------------------------------------------------------------------
export interface PoItem {
  id: string;
  po_id: string;
  tenant_id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  unit: string;
  ordered_qty: number;
  received_qty: number;
  purchase_price: number;
  subtotal: number;
  selling_price: number | null;
}

export type PoItemInsert = Omit<PoItem, 'id'> & { id?: string };


// ---------------------------------------------------------------------------
// 19. GoodsReceipt
// ---------------------------------------------------------------------------
export interface GoodsReceipt {
  id: string;
  tenant_id: string;
  branch_id: string;
  gr_number: string;
  purchase_order_id: string;
  supplier_id: string;
  received_by: string | null;
  received_at: string;
  notes: string | null;
}

export type GoodsReceiptInsert = Omit<GoodsReceipt, 'id'> & { id?: string };


// ---------------------------------------------------------------------------
// 20. GrItem (GoodsReceiptItem)
// ---------------------------------------------------------------------------
export interface GrItem {
  id: string;
  gr_id: string;
  tenant_id: string;
  product_id: string | null;
  product_name: string;
  ordered_qty: number;
  received_qty: number;
  unit: string;
}

export type GrItemInsert = Omit<GrItem, 'id'> & { id?: string };


// ---------------------------------------------------------------------------
// 21. SalesOrder
// ---------------------------------------------------------------------------
export interface SalesOrder {
  id: string;
  tenant_id: string;
  branch_id: string;
  so_number: string;
  customer_id: string | null;
  customer_name: string;
  delivery_address: string | null;
  subtotal: number;
  discount_amount: number;
  grand_total: number;
  down_payment: number;
  remaining_payment: number;   // GENERATED ALWAYS AS STORED
  status: DbSoStatus;
  payment_status: DbSoPaymentStatus;
  estimated_delivery_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type SalesOrderInsert = Omit<SalesOrder, 'id' | 'remaining_payment' | 'created_at'> & { id?: string };
export type SalesOrderUpdate = Partial<Pick<SalesOrder,
  'status' | 'payment_status' | 'notes' | 'down_payment' | 'estimated_delivery_date'
>>;


// ---------------------------------------------------------------------------
// 22. SalesOrderItem
// ---------------------------------------------------------------------------
export interface SalesOrderItem {
  id: string;
  so_id: string;
  tenant_id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  unit: string;
  qty: number;
  selling_price: number;
  discount: number;
  subtotal: number;
  delivered_qty: number;
  status: DbSoItemStatus;
}

export type SalesOrderItemInsert = Omit<SalesOrderItem, 'id'> & { id?: string };


// ---------------------------------------------------------------------------
// 23. SoFulfillment
// ---------------------------------------------------------------------------
export interface SoFulfillment {
  id: string;
  so_item_id: string;
  tenant_id: string;
  source: DbFulfillmentSrc;
  qty: number;
  purchase_order_id: string | null;
  supplier_id: string | null;
  purchase_price_at_time: number;
  status: DbFulfillmentStatus;
  created_at: string;
}

export type SoFulfillmentInsert = Omit<SoFulfillment, 'id'> & { id?: string };
export type SoFulfillmentUpdate = Partial<Pick<SoFulfillment, 'status' | 'qty'>>;


// ---------------------------------------------------------------------------
// 24. CashAccount
// ---------------------------------------------------------------------------
export interface CashAccount {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  type: DbAccountType;
  account_number: string | null;
  balance: number;
  is_active: boolean;
  is_default: boolean;
}

export type CashAccountInsert = Omit<CashAccount, 'id' | 'is_default'> & { id?: string; is_default?: boolean };
export type CashAccountUpdate = Partial<Omit<CashAccountInsert, 'tenant_id' | 'branch_id'>>;


// ---------------------------------------------------------------------------
// 25. CashTransaction
// ---------------------------------------------------------------------------
export interface CashTransaction {
  id: string;
  tenant_id: string;
  branch_id: string;
  cash_account_id: string;
  type: DbCashTxType;
  category: string;
  amount: number;
  reference: string | null;
  description: string | null;
  user_id: string | null;
  counterpart_account_id: string | null;
  pair_id: string | null;
  created_at: string;
}

export type CashTransactionInsert = Omit<
  CashTransaction,
  'id' | 'created_at' | 'counterpart_account_id' | 'pair_id'
> & {
  id?: string;
  created_at?: string;
  counterpart_account_id?: string | null;
  pair_id?: string | null;
};


// ---------------------------------------------------------------------------
// 25b. OwnerCapitalTransaction
// ---------------------------------------------------------------------------
export interface OwnerCapitalTransaction {
  id: string;
  tenant_id: string;
  branch_id: string;
  cash_account_id: string;
  kind: DbOwnerCapitalKind;
  amount: number;
  occurred_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type OwnerCapitalTransactionInsert = Omit<OwnerCapitalTransaction, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};


// ---------------------------------------------------------------------------
// 26. AccountReceivable
// ---------------------------------------------------------------------------
export interface AccountReceivable {
  id: string;
  tenant_id: string;
  branch_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  sales_transaction_id: string | null;
  sales_order_id: string | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;    // GENERATED ALWAYS AS STORED
  due_date: string;
  status: DbArStatus;
  created_at: string;
}

export type AccountReceivableInsert = Omit<AccountReceivable, 'id' | 'remaining_amount' | 'created_at'> & { id?: string };
export type AccountReceivableUpdate = Partial<Pick<AccountReceivable,
  'status' | 'paid_amount' | 'due_date'
>>;


// ---------------------------------------------------------------------------
// 27. ArPayment
// ---------------------------------------------------------------------------
export interface ArPayment {
  id: string;
  ar_id: string;
  tenant_id: string;
  amount: number;
  payment_date: string;
  payment_method: DbArPaymentMethod;
  notes: string | null;
  user_id: string | null;
}

export type ArPaymentInsert = Omit<ArPayment, 'id'> & { id?: string };


// ---------------------------------------------------------------------------
// 28. AccountPayable
// ---------------------------------------------------------------------------
export interface AccountPayable {
  id: string;
  tenant_id: string;
  branch_id: string;
  invoice_number: string;
  supplier_id: string;
  supplier_name: string;
  purchase_order_id: string | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;    // GENERATED ALWAYS AS STORED
  due_date: string;
  status: DbApStatus;
  created_at: string;
}

export type AccountPayableInsert = Omit<AccountPayable, 'id' | 'remaining_amount' | 'created_at'> & { id?: string };
export type AccountPayableUpdate = Partial<Pick<AccountPayable,
  'status' | 'paid_amount' | 'due_date'
>>;


// ---------------------------------------------------------------------------
// 29. ApPayment
// ---------------------------------------------------------------------------
export interface ApPayment {
  id: string;
  ap_id: string;
  tenant_id: string;
  amount: number;
  cash_account_id: string | null;
  payment_date: string;
  notes: string | null;
  user_id: string | null;
}

export type ApPaymentInsert = Omit<ApPayment, 'id'> & { id?: string };


// ---------------------------------------------------------------------------
// 30. OfflineTxQueue
// ---------------------------------------------------------------------------
export interface OfflineTxQueue {
  id: string;
  local_id: string;
  tenant_id: string;
  branch_id: string;
  session_id: string | null;
  payload: Record<string, unknown>;   // full SalesTransaction JSON
  offline_created_at: string;
  sync_status: DbSyncStatus;
  retry_count: number;
  last_retry_at: string | null;
  server_tx_id: string | null;
  flags: DbOfflineFlag[];
}

export type OfflineTxQueueInsert = Omit<OfflineTxQueue, 'id'> & { id?: string };
export type OfflineTxQueueUpdate = Partial<Pick<OfflineTxQueue,
  'sync_status' | 'retry_count' | 'last_retry_at' | 'server_tx_id' | 'flags'
>>;


// ---------------------------------------------------------------------------
// 31. ReconciliationAlert
// ---------------------------------------------------------------------------
export interface ReconciliationAlert {
  id: string;
  tenant_id: string;
  branch_id: string;
  triggered_at: string;
  total_flagged: number;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
}

export type ReconciliationAlertInsert = Omit<ReconciliationAlert, 'id'> & { id?: string };


// ---------------------------------------------------------------------------
// 32. ReconciliationAlertItem
// ---------------------------------------------------------------------------
export interface ReconciliationAlertItem {
  id: string;
  alert_id: string;
  tenant_id: string;
  server_tx_id: string | null;
  cashier_name: string;
  flag: DbReconcileFlag;
  product_name: string | null;
  customer_name: string | null;
  detail: string;
  action_taken: string | null;
}

export type ReconciliationAlertItemInsert = Omit<ReconciliationAlertItem, 'id'> & { id?: string };

// =============================================================================
// Drizzle schema — Phase 1 tables (Neon)
// =============================================================================

import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  primaryKey,
  unique,
  bigint,
  integer,
  smallint,
  numeric,
  date,
} from "drizzle-orm/pg-core";

export const tenantPlanEnum = pgEnum("tenant_plan", [
  "trial",
  "basic",
  "pro",
  "enterprise",
]);

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "manager",
  "cashier",
  "warehouse",
  "accountant",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerEmail: text("owner_email").notNull(),
  phone: text("phone"),
  plan: tenantPlanEnum("plan").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  legacyModeActive: boolean("legacy_mode_active").notNull().default(false),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authUsers = pgTable("auth_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: varchar("username", { length: 32 }),
  passwordHash: text("password_hash").notNull(),
  googleSub: text("google_sub").unique(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    address: text("address"),
    phone: text("phone"),
    managerId: uuid("manager_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.code)],
);

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: userRoleEnum("role").notNull().default("cashier"),
  pin: varchar("pin", { length: 6 }),
  phone: text("phone"),
  address: text("address"),
  dateOfBirth: date("date_of_birth"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userBranches = pgTable(
  "user_branches",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.branchId] })],
);

// ---------------------------------------------------------------------------
// Phase 2 — catalog, customers, stock
// ---------------------------------------------------------------------------

export const customerTypeEnum = pgEnum("customer_type", ["retail", "credit"]);
export const stockSourceEnum = pgEnum("stock_source", ["verified", "legacy", "unverified"]);
export const movementTypeEnum = pgEnum("movement_type", [
  "in",
  "out",
  "adjustment",
  "opname",
  "transfer_out",
  "transfer_in",
  "legacy_in",
  "legacy_out",
]);

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.name)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    name: text("name").notNull(),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),
    unit: text("unit").notNull().default("pcs"),
    purchasePrice: bigint("purchase_price", { mode: "number" }).notNull().default(0),
    isReturnable: boolean("is_returnable").notNull().default(true),
    returnBlockLabel: text("return_block_label"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.sku)],
);

export const branchProducts = pgTable(
  "branch_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sellingPrice: bigint("selling_price", { mode: "number" }).notNull().default(0),
    stock: integer("stock").notNull().default(0),
    legacyStock: integer("legacy_stock").notNull().default(0),
    reorderPoint: integer("reorder_point").notNull().default(0),
    warehouseLocation: text("warehouse_location"),
  },
  (t) => [unique().on(t.branchId, t.productId)],
);

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  type: customerTypeEnum("type").notNull().default("retail"),
  creditLimit: bigint("credit_limit", { mode: "number" }).notNull().default(0),
  outstandingDebt: bigint("outstanding_debt", { mode: "number" }).notNull().default(0),
  pricingTierId: uuid("pricing_tier_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  type: movementTypeEnum("type").notNull(),
  stockSource: stockSourceEnum("stock_source").notNull().default("verified"),
  qty: integer("qty").notNull(),
  qtyBefore: integer("qty_before").notNull(),
  qtyAfter: integer("qty_after").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Phase 3 — POS sessions, carts, sales
// ---------------------------------------------------------------------------

export const sessionStatusEnum = pgEnum("session_status", ["open", "closed"]);
export const cartStatusEnum = pgEnum("cart_status", ["active", "hold", "paid", "cancelled"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "qris_edc",
  "qris_gopay",
  "qris_ovo",
  "qris_other",
  "transfer",
  "credit",
]);
export const txStatusEnum = pgEnum("tx_status", ["completed", "voided", "returned"]);

export const salesReturnStatusEnum = pgEnum("sales_return_status", [
  "pending_qc",
  "qc_completed",
  "pending_approval",
  "pending_offset",
  "completed",
  "rejected",
  "cancelled",
]);

export const salesReturnSettlementEnum = pgEnum("sales_return_settlement", [
  "standalone_refund",
  "offset_in_new_sale",
]);

export const salesReturnRefundMethodEnum = pgEnum("sales_return_refund_method", [
  "cash",
  "transfer",
  "credit_adjust",
]);

export const cashierSessions = pgTable("cashier_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  cashierId: uuid("cashier_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  status: sessionStatusEnum("status").notNull().default("open"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingCashBalance: bigint("opening_cash_balance", { mode: "number" }).notNull().default(0),
  expectedCashBalance: bigint("expected_cash_balance", { mode: "number" }).notNull().default(0),
  actualCashBalance: bigint("actual_cash_balance", { mode: "number" }),
  totalSales: bigint("total_sales", { mode: "number" }).notNull().default(0),
  totalCashSales: bigint("total_cash_sales", { mode: "number" }).notNull().default(0),
  totalCardSales: bigint("total_card_sales", { mode: "number" }).notNull().default(0),
  totalTransferSales: bigint("total_transfer_sales", { mode: "number" }).notNull().default(0),
  totalCreditSales: bigint("total_credit_sales", { mode: "number" }).notNull().default(0),
  totalTransactions: integer("total_transactions").notNull().default(0),
  notes: text("notes"),
});

export const posCarts = pgTable("pos_carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => cashierSessions.id, { onDelete: "cascade" }),
  cashierId: uuid("cashier_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  cartNumber: smallint("cart_number").notNull(),
  customerName: text("customer_name"),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  status: cartStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salesTransactions = pgTable(
  "sales_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => cashierSessions.id, { onDelete: "restrict" }),
    cartId: uuid("cart_id").references(() => posCarts.id, { onDelete: "set null" }),
    transactionNumber: text("transaction_number").notNull(),
    clientTxId: text("client_tx_id"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name"),
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    discountAmount: bigint("discount_amount", { mode: "number" }).notNull().default(0),
    taxAmount: bigint("tax_amount", { mode: "number" }).notNull().default(0),
    grandTotal: bigint("grand_total", { mode: "number" }).notNull().default(0),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    qrisProvider: varchar("qris_provider", { length: 50 }),
    amountPaid: bigint("amount_paid", { mode: "number" }).notNull().default(0),
    changeAmount: bigint("change_amount", { mode: "number" }).notNull().default(0),
    inputBy: uuid("input_by").references(() => profiles.id, { onDelete: "set null" }),
    paidBy: uuid("paid_by").references(() => profiles.id, { onDelete: "set null" }),
    isCrossSession: boolean("is_cross_session").notNull().default(false),
    hasLegacyItems: boolean("has_legacy_items").notNull().default(false),
    isOfflineTransaction: boolean("is_offline_transaction").notNull().default(false),
    offlineCreatedAt: timestamp("offline_created_at", { withTimezone: true }),
    syncStatus: text("sync_status").notNull().default("synced"),
    status: txStatusEnum("status").notNull().default("completed"),
    returnStatus: text("return_status").notNull().default("none"),
    returnOffsetAmount: bigint("return_offset_amount", { mode: "number" }).notNull().default(0),
    linkedReturnId: uuid("linked_return_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.tenantId, t.transactionNumber),
    unique().on(t.tenantId, t.clientTxId),
  ],
);

export const salesItems = pgTable("sales_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => salesTransactions.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  unit: text("unit").notNull(),
  qty: integer("qty").notNull(),
  purchasePrice: bigint("purchase_price", { mode: "number" }).notNull().default(0),
  sellingPrice: bigint("selling_price", { mode: "number" }).notNull().default(0),
  discount: bigint("discount", { mode: "number" }).notNull().default(0),
  subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
  stockSource: stockSourceEnum("stock_source").notNull().default("verified"),
  /** Baris indent/SO — tidak mengurangi stok cabang saat checkout POS */
  isSoLine: boolean("is_so_line").notNull().default(false),
  qtyReturned: integer("qty_returned").notNull().default(0),
});

export const returnSettings = pgTable("return_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  refundWindowDays: integer("refund_window_days").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salesReturns = pgTable(
  "sales_returns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    returnNumber: text("return_number").notNull(),
    originalTransactionId: uuid("original_transaction_id")
      .notNull()
      .references(() => salesTransactions.id, { onDelete: "restrict" }),
    originalTransactionNumber: text("original_transaction_number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name"),
    status: salesReturnStatusEnum("status").notNull().default("pending_qc"),
    settlement: salesReturnSettlementEnum("settlement"),
    isLateReturn: boolean("is_late_return").notNull().default(false),
    refundMethod: salesReturnRefundMethodEnum("refund_method"),
    requestedRefundAmount: bigint("requested_refund_amount", { mode: "number" }).notNull().default(0),
    approvedRefundAmount: bigint("approved_refund_amount", { mode: "number" }).notNull().default(0),
    offsetTransactionId: uuid("offset_transaction_id").references(() => salesTransactions.id, {
      onDelete: "set null",
    }),
    reasonNotes: text("reason_notes"),
    requestedBy: uuid("requested_by").references(() => profiles.id, { onDelete: "set null" }),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    qcBy: uuid("qc_by").references(() => profiles.id, { onDelete: "set null" }),
    qcAt: timestamp("qc_at", { withTimezone: true }),
    qcNotes: text("qc_notes"),
    approvedBy: uuid("approved_by").references(() => profiles.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.returnNumber)],
);

export const salesReturnItems = pgTable("sales_return_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  returnId: uuid("return_id")
    .notNull()
    .references(() => salesReturns.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  originalSalesItemId: uuid("original_sales_item_id")
    .notNull()
    .references(() => salesItems.id, { onDelete: "restrict" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  unit: text("unit").notNull(),
  qtySold: integer("qty_sold").notNull(),
  qtyRequested: integer("qty_requested").notNull(),
  qtyQcPassed: integer("qty_qc_passed").notNull().default(0),
  unitRefundPrice: bigint("unit_refund_price", { mode: "number" }).notNull().default(0),
  refundSubtotal: bigint("refund_subtotal", { mode: "number" }).notNull().default(0),
  qcPassed: boolean("qc_passed"),
  qcRejectReason: text("qc_reject_reason"),
  stockSource: stockSourceEnum("stock_source").notNull().default("verified"),
  isNonReturnable: boolean("is_non_returnable").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Phase 4 — finance, AR, AP
// ---------------------------------------------------------------------------

export const accountTypeEnum = pgEnum("account_type", ["cash", "bank"]);
export const cashTxTypeEnum = pgEnum("cash_tx_type", ["income", "expense", "transfer"]);
export const arStatusEnum = pgEnum("ar_status", ["unpaid", "partial", "paid", "overdue"]);
export const apStatusEnum = pgEnum("ap_status", ["unpaid", "partial", "paid", "overdue"]);
export const arPaymentMethodEnum = pgEnum("ar_payment_method", ["cash", "transfer"]);

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  address: text("address"),
  email: text("email"),
  paymentTermDays: integer("payment_term_days").notNull().default(30),
  outstandingDebt: bigint("outstanding_debt", { mode: "number" }).notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const productSuppliers = pgTable(
  "product_suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    isPreferred: boolean("is_preferred").notNull().default(false),
  },
  (t) => [unique().on(t.tenantId, t.productId, t.supplierId)],
);

export const cashAccounts = pgTable("cash_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull().default("cash"),
  accountNumber: text("account_number"),
  balance: bigint("balance", { mode: "number" }).notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const cashTransactions = pgTable("cash_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  cashAccountId: uuid("cash_account_id")
    .notNull()
    .references(() => cashAccounts.id, { onDelete: "restrict" }),
  type: cashTxTypeEnum("type").notNull(),
  category: text("category").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  reference: text("reference"),
  description: text("description"),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountsReceivable = pgTable(
  "accounts_receivable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    customerName: text("customer_name").notNull(),
    salesTransactionId: uuid("sales_transaction_id").references(() => salesTransactions.id, {
      onDelete: "set null",
    }),
    salesOrderId: uuid("sales_order_id"),
    totalAmount: bigint("total_amount", { mode: "number" }).notNull().default(0),
    paidAmount: bigint("paid_amount", { mode: "number" }).notNull().default(0),
    dueDate: date("due_date").notNull(),
    status: arStatusEnum("status").notNull().default("unpaid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.invoiceNumber)],
);

export const arPayments = pgTable("ar_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  arId: uuid("ar_id")
    .notNull()
    .references(() => accountsReceivable.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  amount: bigint("amount", { mode: "number" }).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentMethod: arPaymentMethodEnum("payment_method").notNull().default("cash"),
  notes: text("notes"),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
});

export const accountsPayable = pgTable(
  "accounts_payable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    supplierName: text("supplier_name").notNull(),
    purchaseOrderId: uuid("purchase_order_id"),
    totalAmount: bigint("total_amount", { mode: "number" }).notNull().default(0),
    paidAmount: bigint("paid_amount", { mode: "number" }).notNull().default(0),
    dueDate: date("due_date").notNull(),
    status: apStatusEnum("status").notNull().default("unpaid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.invoiceNumber)],
);

export const apPayments = pgTable("ap_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  apId: uuid("ap_id")
    .notNull()
    .references(() => accountsPayable.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  amount: bigint("amount", { mode: "number" }).notNull(),
  cashAccountId: uuid("cash_account_id").references(() => cashAccounts.id, {
    onDelete: "set null",
  }),
  paymentDate: date("payment_date").notNull(),
  notes: text("notes"),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
});

// ---------------------------------------------------------------------------
// Phase 5 — transfers, PO/GRN, sales orders
// ---------------------------------------------------------------------------

export const transferStatusEnum = pgEnum("transfer_status", [
  "draft",
  "sent",
  "received",
  "cancelled",
]);
export const poTypeEnum = pgEnum("po_type", ["regular", "indent"]);
export const poStatusEnum = pgEnum("po_status", [
  "draft",
  "awaiting_supplier",
  "sent",
  "partial_received",
  "received",
  "cancelled",
]);
export const soStatusEnum = pgEnum("so_status", [
  "draft",
  "confirmed",
  "partial_delivered",
  "completed",
  "cancelled",
]);
export const soPaymentStatusEnum = pgEnum("so_payment_status", ["unpaid", "partial", "paid"]);
export const soItemStatusEnum = pgEnum("so_item_status", ["pending", "partial", "fulfilled"]);
export const fulfillmentSourceEnum = pgEnum("fulfillment_source", ["stock", "indent"]);
export const fulfillmentStatusEnum = pgEnum("fulfillment_status", [
  "planned",
  "in_progress",
  "delivered",
]);

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    soNumber: text("so_number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    deliveryAddress: text("delivery_address"),
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    discountAmount: bigint("discount_amount", { mode: "number" }).notNull().default(0),
    grandTotal: bigint("grand_total", { mode: "number" }).notNull().default(0),
    downPayment: bigint("down_payment", { mode: "number" }).notNull().default(0),
    status: soStatusEnum("status").notNull().default("draft"),
    paymentStatus: soPaymentStatusEnum("payment_status").notNull().default("unpaid"),
    estimatedDeliveryDate: date("estimated_delivery_date"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.soNumber)],
);

export const salesOrderItems = pgTable("sales_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  soId: uuid("so_id")
    .notNull()
    .references(() => salesOrders.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  unit: text("unit").notNull(),
  qty: integer("qty").notNull(),
  sellingPrice: bigint("selling_price", { mode: "number" }).notNull().default(0),
  discount: bigint("discount", { mode: "number" }).notNull().default(0),
  subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
  deliveredQty: integer("delivered_qty").notNull().default(0),
  status: soItemStatusEnum("status").notNull().default("pending"),
});

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    poNumber: text("po_number").notNull(),
    type: poTypeEnum("type").notNull().default("regular"),
    salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, { onDelete: "set null" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    deliveryAddress: text("delivery_address"),
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    grandTotal: bigint("grand_total", { mode: "number" }).notNull().default(0),
    status: poStatusEnum("status").notNull().default("draft"),
    expectedDate: date("expected_date"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.poNumber)],
);

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  poId: uuid("po_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  unit: text("unit").notNull(),
  orderedQty: integer("ordered_qty").notNull().default(0),
  receivedQty: integer("received_qty").notNull().default(0),
  purchasePrice: bigint("purchase_price", { mode: "number" }).notNull().default(0),
  subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
});

export const goodsReceipts = pgTable(
  "goods_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    grNumber: text("gr_number").notNull(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    receivedBy: uuid("received_by").references(() => profiles.id, { onDelete: "set null" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
  },
  (t) => [unique().on(t.tenantId, t.grNumber)],
);

export const goodsReceiptItems = pgTable("goods_receipt_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  grId: uuid("gr_id")
    .notNull()
    .references(() => goodsReceipts.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  orderedQty: integer("ordered_qty").notNull().default(0),
  receivedQty: integer("received_qty").notNull().default(0),
  unit: text("unit").notNull(),
});

export const soFulfillments = pgTable("so_fulfillments", {
  id: uuid("id").primaryKey().defaultRandom(),
  soItemId: uuid("so_item_id")
    .notNull()
    .references(() => salesOrderItems.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  source: fulfillmentSourceEnum("source").notNull(),
  qty: integer("qty").notNull(),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, {
    onDelete: "set null",
  }),
  supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  purchasePriceAtTime: bigint("purchase_price_at_time", { mode: "number" }).notNull().default(0),
  status: fulfillmentStatusEnum("status").notNull().default("planned"),
});

export const stockTransfers = pgTable(
  "stock_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    transferNumber: text("transfer_number").notNull(),
    fromBranchId: uuid("from_branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    toBranchId: uuid("to_branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    status: transferStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    confirmedBy: uuid("confirmed_by").references(() => profiles.id, { onDelete: "set null" }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.transferNumber)],
);

export const stockTransferItems = pgTable("stock_transfer_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  transferId: uuid("transfer_id")
    .notNull()
    .references(() => stockTransfers.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  unit: text("unit").notNull(),
  requestedQty: integer("requested_qty").notNull().default(0),
  sentQty: integer("sent_qty").notNull().default(0),
  receivedQty: integer("received_qty").notNull().default(0),
});

// --- Phase 8 (Fase C) ---

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "preparing",
  "in_transit",
  "delivered",
  "partial_delivered",
  "cancelled",
]);

export const onlineOrderStatusEnum = pgEnum("online_order_status", [
  "pending_approval",
  "approved",
  "payment_uploaded",
  "processing",
  "shipped",
  "completed",
  "cancelled",
  "rejected",
]);

export const dailyBranchSales = pgTable(
  "daily_branch_sales",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    saleDate: date("sale_date").notNull(),
    txCount: integer("tx_count").notNull().default(0),
    totalRevenue: bigint("total_revenue", { mode: "number" }).notNull().default(0),
    cashRevenue: bigint("cash_revenue", { mode: "number" }).notNull().default(0),
    transferRevenue: bigint("transfer_revenue", { mode: "number" }).notNull().default(0),
    qrisRevenue: bigint("qris_revenue", { mode: "number" }).notNull().default(0),
    creditRevenue: bigint("credit_revenue", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.branchId, t.saleDate] })],
);

export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    salesTransactionId: uuid("sales_transaction_id").references(() => salesTransactions.id, {
      onDelete: "set null",
    }),
    deliveryNumber: text("delivery_number").notNull(),
    customerName: text("customer_name"),
    deliveryAddress: text("delivery_address"),
    status: deliveryStatusEnum("status").notNull().default("pending"),
    grandTotal: bigint("grand_total", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.deliveryNumber)],
);

export const onlineOrders = pgTable(
  "online_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    status: onlineOrderStatusEnum("status").notNull().default("pending_approval"),
    grandTotal: bigint("grand_total", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.orderNumber)],
);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  metadata: text("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Phase 12 — pricing tiers & margin floors
// ---------------------------------------------------------------------------

export const pricingSettings = pgTable("pricing_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  maxStackDiscountPercent: integer("max_stack_discount_percent").notNull().default(12),
  maxLineDiscountPercent: integer("max_line_discount_percent").notNull().default(10),
  defaultMinMarginPercent: integer("default_min_margin_percent").notNull().default(10),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => profiles.id, { onDelete: "set null" }),
});

export const volumePriceTiers = pgTable(
  "volume_price_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tierCode: text("tier_code").notNull(),
    name: text("name").notNull(),
    minQty: integer("min_qty").notNull().default(0),
    minLineAmount: bigint("min_line_amount", { mode: "number" }).notNull().default(0),
    discountPercent: integer("discount_percent").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.tierCode)],
);

export const customerPriceTiers = pgTable(
  "customer_price_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tierCode: text("tier_code").notNull(),
    name: text("name").notNull(),
    discountPercent: integer("discount_percent").notNull().default(0),
    minTransactions: integer("min_transactions"),
    minRollingOmzet: bigint("min_rolling_omzet", { mode: "number" }),
    rollingDays: integer("rolling_days"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.tierCode)],
);

export const categoryMarginFloors = pgTable(
  "category_margin_floors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "cascade",
    }),
    minMarginPercent: integer("min_margin_percent").notNull(),
  },
  (t) => [unique().on(t.tenantId, t.categoryId)],
);

export const pricingOverrideLogs = pgTable("pricing_override_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  salesTransactionId: uuid("sales_transaction_id").references(() => salesTransactions.id, {
    onDelete: "set null",
  }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  sku: text("sku").notNull(),
  basePrice: bigint("base_price", { mode: "number" }).notNull(),
  floorPrice: bigint("floor_price", { mode: "number" }).notNull(),
  overridePrice: bigint("override_price", { mode: "number" }).notNull(),
  reason: text("reason").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

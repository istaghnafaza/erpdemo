// =============================================================================
// Map Drizzle rows → database.ts snake_case types
// =============================================================================

import {
  normalizeBranchPaymentSettings,
  type BranchPaymentSettings,
} from "@/types/payment-settings";
import type {
  Branch,
  BranchProduct,
  BranchProductWithProduct,
  CashierSession,
  Customer,
  PosCart,
  Product,
  ProductCategory,
  Profile,
  SalesItem,
  SalesTransaction,
  StockMovement,
  Tenant,
  CashAccount,
  CashTransaction,
  AccountReceivable,
  ArPayment,
  AccountPayable,
  ApPayment,
  Supplier,
  PurchaseOrder,
  PoItem,
  GoodsReceipt,
  GrItem,
  SalesOrder,
  SalesOrderItem,
  SoFulfillment,
  StockTransfer,
  StockTransferItem,
  OwnerCapitalTransaction,
} from "@/types/database";
import type {
  branches,
  branchProducts,
  cashierSessions,
  customers,
  posCarts,
  productCategories,
  products,
  productSellUnits,
  profiles,
  salesItems,
  salesTransactions,
  stockMovements,
  tenants,
  cashAccounts,
  cashTransactions,
  accountsReceivable,
  arPayments,
  accountsPayable,
  apPayments,
  suppliers,
  purchaseOrders,
  purchaseOrderItems,
  goodsReceipts,
  goodsReceiptItems,
  salesOrders,
  salesOrderItems,
  soFulfillments,
  stockTransfers,
  stockTransferItems,
  ownerCapitalTransactions,
} from "@/server/db/schema";

type TenantRow = typeof tenants.$inferSelect;
type BranchRow = typeof branches.$inferSelect;
type ProfileRow = typeof profiles.$inferSelect;
type ProductCategoryRow = typeof productCategories.$inferSelect;
type ProductRow = typeof products.$inferSelect;
type BranchProductRow = typeof branchProducts.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type StockMovementRow = typeof stockMovements.$inferSelect;
type CashierSessionRow = typeof cashierSessions.$inferSelect;
type PosCartRow = typeof posCarts.$inferSelect;
type SalesTransactionRow = typeof salesTransactions.$inferSelect;
type SalesItemRow = typeof salesItems.$inferSelect;
type CashAccountRow = typeof cashAccounts.$inferSelect;
type CashTransactionRow = typeof cashTransactions.$inferSelect;
type AccountReceivableRow = typeof accountsReceivable.$inferSelect;
type ArPaymentRow = typeof arPayments.$inferSelect;
type AccountPayableRow = typeof accountsPayable.$inferSelect;
type ApPaymentRow = typeof apPayments.$inferSelect;
type SupplierRow = typeof suppliers.$inferSelect;
type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;
type PoItemRow = typeof purchaseOrderItems.$inferSelect;
type GoodsReceiptRow = typeof goodsReceipts.$inferSelect;
type GrItemRow = typeof goodsReceiptItems.$inferSelect;
type SalesOrderRow = typeof salesOrders.$inferSelect;
type SalesOrderItemRow = typeof salesOrderItems.$inferSelect;
type SoFulfillmentRow = typeof soFulfillments.$inferSelect;
type StockTransferRow = typeof stockTransfers.$inferSelect;
type StockTransferItemRow = typeof stockTransferItems.$inferSelect;
type OwnerCapitalRow = typeof ownerCapitalTransactions.$inferSelect;
type ProductSellUnitRow = typeof productSellUnits.$inferSelect;

/** Coerce Drizzle numeric (string | number) → number. */
export function num(value: string | number | null | undefined, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function stockStr(value: number): string {
  return String(Number.isFinite(value) ? value : 0);
}

export function toTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    owner_email: row.ownerEmail,
    phone: row.phone,
    plan: row.plan,
    trial_ends_at: row.trialEndsAt?.toISOString() ?? null,
    plan_renews_at: row.planRenewsAt?.toISOString() ?? null,
    is_active: row.isActive,
    onboarding_complete: row.onboardingComplete,
    legacy_mode_active: row.legacyModeActive,
    logo_url: row.logoUrl ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function toBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    code: row.code,
    name: row.name,
    address: row.address,
    phone: row.phone,
    manager_id: row.managerId,
    is_active: row.isActive,
    payment_settings: normalizeBranchPaymentSettings(
      row.paymentSettings as BranchPaymentSettings | null | undefined,
    ),
    created_at: row.createdAt.toISOString(),
  };
}

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    name: row.name,
    email: row.email,
    role: row.role,
    pin: row.pin,
    phone: row.phone ?? null,
    address: row.address ?? null,
    date_of_birth: row.dateOfBirth ? String(row.dateOfBirth) : null,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function toProductCategory(row: ProductCategoryRow): ProductCategory {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    name: row.name,
    icon: row.icon,
    created_at: row.createdAt.toISOString(),
  };
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    category_id: row.categoryId,
    unit: row.unit,
    stock_unit: row.stockUnit ?? row.unit,
    purchase_price: row.purchasePrice,
    is_returnable: row.isReturnable,
    return_block_label: row.returnBlockLabel,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function toProductSellUnit(row: ProductSellUnitRow): import("@/lib/product-sell-units").ProductSellUnit {
  const preset = Array.isArray(row.presetQty) ? row.presetQty.map((v) => num(v as never)) : [];
  return {
    id: row.id,
    tenant_id: row.tenantId,
    product_id: row.productId,
    label: row.label,
    factor_to_base: num(row.factorToBase, 1),
    selling_price: row.sellingPrice ?? null,
    purchase_price: row.purchasePrice ?? null,
    sort_order: row.sortOrder,
    is_active: row.isActive,
    allow_fraction: Boolean(row.allowFraction),
    preset_qty: preset,
    created_at:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
    updated_at:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ""),
  };
}

export function toBranchProduct(row: BranchProductRow): BranchProduct {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    product_id: row.productId,
    selling_price: row.sellingPrice,
    stock: num(row.stock),
    legacy_stock: num(row.legacyStock),
    stock_status: (row.stockStatus as BranchProduct["stock_status"]) ?? "verified",
    stock_ownership: (row.stockOwnership as BranchProduct["stock_ownership"]) ?? "owned",
    consignment_supplier_id: row.consignmentSupplierId ?? null,
    reorder_point: row.reorderPoint,
    warehouse_location: row.warehouseLocation,
  };
}

export function toBranchProductWithProduct(
  bp: BranchProductRow,
  product: ProductRow,
  category?: ProductCategoryRow | null,
): BranchProductWithProduct {
  const p = toProduct(product);
  if (category) {
    (p as Product & { category?: { id: string; name: string; icon: string | null } }).category = {
      id: category.id,
      name: category.name,
      icon: category.icon,
    };
  }
  return {
    ...toBranchProduct(bp),
    product: p,
  };
}

export function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    name: row.name,
    phone: row.phone,
    address: row.address,
    type: row.type,
    credit_limit: row.creditLimit,
    outstanding_debt: row.outstandingDebt,
    created_at: row.createdAt.toISOString(),
    pricing_tier_id: row.pricingTierId ?? null,
  };
}

export function toStockMovement(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    product_id: row.productId,
    type: row.type,
    stock_source: row.stockSource,
    qty: num(row.qty),
    qty_before: num(row.qtyBefore),
    qty_after: num(row.qtyAfter),
    reference: row.reference,
    notes: row.notes,
    user_id: row.userId,
    created_at: row.createdAt.toISOString(),
  };
}

export function toCashierSession(row: CashierSessionRow): CashierSession {
  const actual = row.actualCashBalance;
  const expected = row.expectedCashBalance;
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    cashier_id: row.cashierId,
    status: row.status,
    opened_at: row.openedAt.toISOString(),
    closed_at: row.closedAt?.toISOString() ?? null,
    opening_cash_balance: row.openingCashBalance,
    expected_cash_balance: expected,
    actual_cash_balance: actual ?? null,
    cash_discrepancy: actual != null ? actual - expected : null,
    total_sales: row.totalSales,
    total_cash_sales: row.totalCashSales,
    total_card_sales: row.totalCardSales,
    total_transfer_sales: row.totalTransferSales,
    total_credit_sales: row.totalCreditSales,
    total_transactions: row.totalTransactions,
    notes: row.notes,
  };
}

export function toPosCart(row: PosCartRow): PosCart {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    session_id: row.sessionId,
    cashier_id: row.cashierId,
    cart_number: row.cartNumber,
    customer_name: row.customerName,
    customer_id: row.customerId,
    discount_percent: Number(row.discountPercent),
    notes: row.notes,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function toSalesTransaction(row: SalesTransactionRow): SalesTransaction {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    session_id: row.sessionId,
    cart_id: row.cartId,
    transaction_number: row.transactionNumber,
    client_tx_id: row.clientTxId,
    customer_id: row.customerId,
    customer_name: row.customerName,
    subtotal: row.subtotal,
    discount_amount: row.discountAmount,
    tax_amount: row.taxAmount,
    grand_total: row.grandTotal,
    payment_method: row.paymentMethod,
    qris_provider: row.qrisProvider,
    amount_paid: row.amountPaid,
    change_amount: row.changeAmount,
    input_by: row.inputBy,
    paid_by: row.paidBy,
    is_cross_session: row.isCrossSession,
    has_legacy_items: row.hasLegacyItems,
    is_offline_transaction: row.isOfflineTransaction,
    offline_created_at: row.offlineCreatedAt?.toISOString() ?? null,
    sync_status: row.syncStatus as SalesTransaction["sync_status"],
    status: row.status,
    return_status: row.returnStatus as SalesTransaction["return_status"],
    return_offset_amount: row.returnOffsetAmount,
    linked_return_id: row.linkedReturnId,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
  };
}

export function toSalesItem(row: SalesItemRow): SalesItem {
  return {
    id: row.id,
    transaction_id: row.transactionId,
    tenant_id: row.tenantId,
    product_id: row.productId,
    product_name: row.productName,
    sku: row.sku,
    unit: row.unit,
    qty: num(row.qty),
    purchase_price: row.purchasePrice,
    selling_price: row.sellingPrice,
    discount: row.discount,
    subtotal: row.subtotal,
    stock_source: row.stockSource,
    is_so_line: row.isSoLine,
    qty_returned: row.qtyReturned,
    sell_unit_id: row.sellUnitId ?? null,
    sell_unit_label: row.sellUnitLabel ?? null,
    qty_base: row.qtyBase != null ? num(row.qtyBase) : num(row.qty),
    factor_to_base: row.factorToBase != null ? num(row.factorToBase, 1) : 1,
  };
}

function formatDate(d: string | Date): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function toCashAccount(row: CashAccountRow): CashAccount {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    name: row.name,
    type: row.type,
    account_number: row.accountNumber,
    balance: row.balance,
    is_active: row.isActive,
    is_default: row.isDefault ?? false,
  };
}

export function toCashTransaction(row: CashTransactionRow): CashTransaction {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    cash_account_id: row.cashAccountId,
    type: row.type,
    category: row.category,
    amount: row.amount,
    reference: row.reference,
    description: row.description,
    user_id: row.userId,
    counterpart_account_id: row.counterpartAccountId ?? null,
    pair_id: row.pairId ?? null,
    created_at: row.createdAt.toISOString(),
  };
}

export function toAccountReceivable(row: AccountReceivableRow): AccountReceivable {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    invoice_number: row.invoiceNumber,
    customer_id: row.customerId,
    customer_name: row.customerName,
    sales_transaction_id: row.salesTransactionId,
    sales_order_id: row.salesOrderId,
    total_amount: row.totalAmount,
    paid_amount: row.paidAmount,
    remaining_amount: row.totalAmount - row.paidAmount,
    due_date: formatDate(row.dueDate),
    status: row.status,
    created_at: row.createdAt.toISOString(),
  };
}

export function toArPayment(row: ArPaymentRow): ArPayment {
  return {
    id: row.id,
    ar_id: row.arId,
    tenant_id: row.tenantId,
    amount: row.amount,
    payment_date: formatDate(row.paymentDate),
    payment_method: row.paymentMethod,
    notes: row.notes,
    user_id: row.userId,
  };
}

export function toAccountPayable(row: AccountPayableRow): AccountPayable {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    invoice_number: row.invoiceNumber,
    supplier_id: row.supplierId,
    supplier_name: row.supplierName,
    purchase_order_id: row.purchaseOrderId,
    total_amount: row.totalAmount,
    paid_amount: row.paidAmount,
    remaining_amount: row.totalAmount - row.paidAmount,
    due_date: formatDate(row.dueDate),
    status: row.status,
    created_at: row.createdAt.toISOString(),
  };
}

export function toApPayment(row: ApPaymentRow): ApPayment {
  return {
    id: row.id,
    ap_id: row.apId,
    tenant_id: row.tenantId,
    amount: row.amount,
    cash_account_id: row.cashAccountId,
    payment_date: formatDate(row.paymentDate),
    notes: row.notes,
    user_id: row.userId,
  };
}

export function toSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    name: row.name,
    contact_person: row.contactPerson,
    phone: row.phone,
    address: row.address,
    email: row.email,
    payment_term_days: row.paymentTermDays,
    outstanding_debt: row.outstandingDebt,
    is_active: row.isActive,
  };
}

export function toPurchaseOrder(row: PurchaseOrderRow): PurchaseOrder {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    po_number: row.poNumber,
    type: row.type,
    ownership_mode: (row.ownershipMode as PurchaseOrder["ownership_mode"]) ?? "owned",
    pay_trigger: (row.payTrigger as PurchaseOrder["pay_trigger"]) ?? "on_receipt_credit",
    discount_amount: row.discountAmount ?? 0,
    rebate_after_qty: row.rebateAfterQty ?? null,
    rebate_per_unit: row.rebatePerUnit ?? 0,
    consignment_sold_qty: row.consignmentSoldQty ?? 0,
    sales_order_id: row.salesOrderId,
    supplier_id: row.supplierId,
    delivery_address: row.deliveryAddress,
    subtotal: row.subtotal,
    grand_total: row.grandTotal,
    status: row.status,
    expected_date: row.expectedDate ? formatDate(row.expectedDate) : null,
    notes: row.notes,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
  };
}

export function toPoItem(row: PoItemRow): PoItem {
  return {
    id: row.id,
    po_id: row.poId,
    tenant_id: row.tenantId,
    product_id: row.productId,
    product_name: row.productName,
    sku: row.sku,
    unit: row.unit,
    ordered_qty: row.orderedQty,
    received_qty: row.receivedQty,
    purchase_price: row.purchasePrice,
    subtotal: row.subtotal,
  };
}

export function toGoodsReceipt(row: GoodsReceiptRow): GoodsReceipt {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    gr_number: row.grNumber,
    purchase_order_id: row.purchaseOrderId,
    supplier_id: row.supplierId,
    received_by: row.receivedBy,
    received_at: row.receivedAt.toISOString(),
    notes: row.notes,
  };
}

export function toGrItem(row: GrItemRow): GrItem {
  return {
    id: row.id,
    gr_id: row.grId,
    tenant_id: row.tenantId,
    product_id: row.productId,
    product_name: row.productName,
    ordered_qty: row.orderedQty,
    received_qty: row.receivedQty,
    unit: row.unit,
  };
}

export function toSalesOrder(row: SalesOrderRow): SalesOrder {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    so_number: row.soNumber,
    customer_id: row.customerId,
    customer_name: row.customerName,
    delivery_address: row.deliveryAddress,
    subtotal: row.subtotal,
    discount_amount: row.discountAmount,
    grand_total: row.grandTotal,
    down_payment: row.downPayment,
    remaining_payment: row.grandTotal - row.downPayment,
    status: row.status,
    payment_status: row.paymentStatus,
    estimated_delivery_date: row.estimatedDeliveryDate
      ? formatDate(row.estimatedDeliveryDate)
      : null,
    notes: row.notes,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
  };
}

export function toSalesOrderItem(row: SalesOrderItemRow): SalesOrderItem {
  return {
    id: row.id,
    so_id: row.soId,
    tenant_id: row.tenantId,
    product_id: row.productId,
    product_name: row.productName,
    sku: row.sku,
    unit: row.unit,
    qty: row.qty,
    selling_price: row.sellingPrice,
    discount: row.discount,
    subtotal: row.subtotal,
    delivered_qty: row.deliveredQty,
    status: row.status,
  };
}

export function toSoFulfillment(row: SoFulfillmentRow): SoFulfillment {
  return {
    id: row.id,
    so_item_id: row.soItemId,
    tenant_id: row.tenantId,
    source: row.source,
    qty: row.qty,
    purchase_order_id: row.purchaseOrderId,
    supplier_id: row.supplierId,
    purchase_price_at_time: row.purchasePriceAtTime,
    status: row.status,
    created_at: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

export function toStockTransfer(row: StockTransferRow): StockTransfer {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    transfer_number: row.transferNumber,
    from_branch_id: row.fromBranchId,
    to_branch_id: row.toBranchId,
    status: row.status,
    notes: row.notes,
    created_by: row.createdBy,
    confirmed_by: row.confirmedBy,
    sent_at: row.sentAt?.toISOString() ?? null,
    received_at: row.receivedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  };
}

export function toStockTransferItem(row: StockTransferItemRow): StockTransferItem {
  return {
    id: row.id,
    transfer_id: row.transferId,
    tenant_id: row.tenantId,
    product_id: row.productId,
    product_name: row.productName,
    sku: row.sku,
    unit: row.unit,
    requested_qty: row.requestedQty,
    sent_qty: row.sentQty,
    received_qty: row.receivedQty,
  };
}

export function toOwnerCapitalTransaction(row: OwnerCapitalRow): OwnerCapitalTransaction {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    branch_id: row.branchId,
    cash_account_id: row.cashAccountId,
    kind: row.kind,
    amount: row.amount,
    occurred_at: formatDate(row.occurredAt),
    notes: row.notes,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
  };
}

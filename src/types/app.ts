// =============================================================================
// SES App Types — camelCase, for use in React components and hooks.
// These are the "UI layer" types. API functions return these (transformed
// from database snake_case types via the API layer).
// =============================================================================

// ---------------------------------------------------------------------------
// Utility: Standard API response envelope
// ---------------------------------------------------------------------------

/** Standard return shape for all API functions */
export type ApiResponse<T> = { data: T; error: null } | { data: null; error: string };

/** Paginated response for list endpoints */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type PaginatedApiResponse<T> =
  | { data: PaginatedResponse<T>; error: null }
  | { data: null; error: string };

/** Supabase-style pagination params */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/** Common date range filter */
export interface DateRangeFilter {
  from: string;  // ISO date string
  to: string;
}


// ---------------------------------------------------------------------------
// Enum types (TypeScript-first, matches SQL enums)
// ---------------------------------------------------------------------------

export const UserRole = {
  OWNER:      'owner',
  MANAGER:    'manager',
  CASHIER:    'cashier',
  WAREHOUSE:  'warehouse',
  ACCOUNTANT: 'accountant',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export const TenantPlan = {
  TRIAL:      'trial',
  BASIC:      'basic',
  PRO:        'pro',
  ENTERPRISE: 'enterprise',
} as const;
export type TenantPlan = typeof TenantPlan[keyof typeof TenantPlan];

export const PaymentMethod = {
  CASH:        'cash',
  CARD:        'card',
  QRIS_EDC:    'qris_edc',
  QRIS_GOPAY:  'qris_gopay',
  QRIS_OVO:    'qris_ovo',
  QRIS_OTHER:  'qris_other',
  TRANSFER:    'transfer',
  CREDIT:      'credit',
} as const;
export type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];

export const ArPaymentMethod = {
  CASH:     'cash',
  TRANSFER: 'transfer',
} as const;
export type ArPaymentMethod = typeof ArPaymentMethod[keyof typeof ArPaymentMethod];

export const OrderStatus = {
  DRAFT:             'draft',
  CONFIRMED:         'confirmed',
  PARTIAL_DELIVERED: 'partial_delivered',
  COMPLETED:         'completed',
  CANCELLED:         'cancelled',
} as const;
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export const PoStatus = {
  DRAFT:            'draft',
  SENT:             'sent',
  PARTIAL_RECEIVED: 'partial_received',
  RECEIVED:         'received',
  CANCELLED:        'cancelled',
} as const;
export type PoStatus = typeof PoStatus[keyof typeof PoStatus];

export const TransferStatus = {
  DRAFT:     'draft',
  SENT:      'sent',
  RECEIVED:  'received',
  CANCELLED: 'cancelled',
} as const;
export type TransferStatus = typeof TransferStatus[keyof typeof TransferStatus];

export const StockSource = {
  VERIFIED:   'verified',
  LEGACY:     'legacy',
  UNVERIFIED: 'unverified',
} as const;
export type StockSource = typeof StockSource[keyof typeof StockSource];

export const ArStatus = {
  UNPAID:  'unpaid',
  PARTIAL: 'partial',
  PAID:    'paid',
  OVERDUE: 'overdue',
} as const;
export type ArStatus = typeof ArStatus[keyof typeof ArStatus];

export const ApStatus = {
  UNPAID:  'unpaid',
  PARTIAL: 'partial',
  PAID:    'paid',
  OVERDUE: 'overdue',
} as const;
export type ApStatus = typeof ApStatus[keyof typeof ApStatus];

export const SyncStatus = {
  PENDING:  'pending',
  SYNCING:  'syncing',
  SYNCED:   'synced',
  FAILED:   'failed',
} as const;
export type SyncStatus = typeof SyncStatus[keyof typeof SyncStatus];

export const ReconcileFlag = {
  STOCK_DEFICIT:    'STOCK_DEFICIT',
  CREDIT_EXCEEDED:  'CREDIT_EXCEEDED',
  PRICE_CHANGED:    'PRICE_CHANGED',
} as const;
export type ReconcileFlag = typeof ReconcileFlag[keyof typeof ReconcileFlag];

export const StockStatus = {
  NORMAL:   'normal',
  LOW:      'low',
  CRITICAL: 'critical',
} as const;
export type StockStatus = typeof StockStatus[keyof typeof StockStatus];


// ---------------------------------------------------------------------------
// Helper: compute stock status badge
// ---------------------------------------------------------------------------
export function getStockStatus(stock: number, reorderPoint: number): StockStatus {
  if (stock <= reorderPoint * 0.4) return 'critical';
  if (stock <= reorderPoint) return 'low';
  return 'normal';
}

/** Format rupiah — use this consistently across UI */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Indonesian display label for a user role — use this consistently across UI */
export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    owner: 'Pemilik',
    manager: 'Manajer',
    cashier: 'Kasir',
    warehouse: 'Gudang',
    accountant: 'Akuntan',
  };
  return labels[role] ?? role;
}

/** Initials for avatar display (e.g. "Budi Santoso" -> "BS") */
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}


// ---------------------------------------------------------------------------
// App-layer types (camelCase)
// ---------------------------------------------------------------------------

export interface AppTenant {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  phone: string | null;
  plan: TenantPlan;
  trialEndsAt: string | null;
  isActive: boolean;
  onboardingComplete: boolean;
  legacyModeActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppBranch {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  managerId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AppProfile {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  pin: string | null;
  phone?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Update profil akun sendiri (sidebar / pengaturan). */
export interface AccountProfileUpdates {
  name?: string;
  phone?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  pin?: string;
}

/** Pegawai tenant — dikelola owner di modul Users. */
export interface TenantUserRecord {
  id: string;
  tenantId: string;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  role: UserRole;
  pin: string;
  branchIds: string[];
  isActive: boolean;
  isProtected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantUserInput {
  name: string;
  username: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  role: UserRole;
  pin: string;
  branchIds: string[];
}

export interface UpdateTenantUserInput {
  name?: string;
  username?: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  role?: UserRole;
  pin?: string;
  branchIds?: string[];
  isActive?: boolean;
}

/** Role yang boleh ditetapkan owner saat menambah pegawai (bukan owner). */
export const ASSIGNABLE_USER_ROLES: UserRole[] = [
  UserRole.MANAGER,
  UserRole.CASHIER,
  UserRole.WAREHOUSE,
  UserRole.ACCOUNTANT,
];

export interface AppProduct {
  id: string;
  tenantId: string;
  sku: string;
  barcode: string | null;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  unit: string;
  purchasePrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppBranchProduct extends AppProduct {
  branchProductId: string;
  branchId: string;
  sellingPrice: number;
  stock: number;
  legacyStock: number;
  totalStock: number;           // stock + legacyStock
  reorderPoint: number;
  warehouseLocation: string | null;
  stockStatus: StockStatus;
}

export interface AppCustomer {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  address: string | null;
  type: 'retail' | 'credit';
  creditLimit: number;
  outstandingDebt: number;
  availableCredit: number;      // creditLimit - outstandingDebt
  createdAt: string;
}

export interface AppSupplier {
  id: string;
  tenantId: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  paymentTermDays: number;
  outstandingDebt: number;
  isActive: boolean;
}

export interface AppCashierSession {
  id: string;
  tenantId: string;
  branchId: string;
  cashierId: string;
  cashierName?: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
  openingCashBalance: number;
  expectedCashBalance: number;
  actualCashBalance: number | null;
  cashDiscrepancy: number | null;
  totalSales: number;
  totalCashSales: number;
  totalCardSales: number;
  totalTransferSales: number;
  totalCreditSales: number;
  totalTransactions: number;
  notes: string | null;
}

export interface AppSalesTransaction {
  id: string;
  tenantId: string;
  branchId: string;
  sessionId: string;
  transactionNumber: string;
  customerId: string | null;
  customerName: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeAmount: number;
  status: 'completed' | 'voided' | 'returned';
  isOfflineTransaction: boolean;
  createdAt: string;
  items?: AppSalesItem[];
}

export interface AppSalesItem {
  id: string;
  transactionId: string;
  productId: string | null;
  productName: string;
  sku: string;
  unit: string;
  qty: number;
  purchasePrice: number;
  sellingPrice: number;
  discount: number;
  subtotal: number;
  stockSource: StockSource;
}

export interface AppAccountReceivable {
  id: string;
  tenantId: string;
  branchId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: ArStatus;
  daysOverdue: number;          // computed: today - dueDate (if overdue)
  createdAt: string;
  payments?: AppArPayment[];
}

export interface AppArPayment {
  id: string;
  arId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: ArPaymentMethod;
  notes: string | null;
}

export interface AppAccountPayable {
  id: string;
  tenantId: string;
  branchId: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: ApStatus;
  daysUntilDue: number;         // computed: dueDate - today (negative if overdue)
  createdAt: string;
}

export interface AppCashAccount {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  type: 'cash' | 'bank';
  accountNumber: string | null;
  balance: number;
  isActive: boolean;
}

export interface AppCashTransaction {
  id: string;
  tenantId: string;
  branchId: string;
  cashAccountId: string;
  cashAccountName?: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  amount: number;
  reference: string | null;
  description: string | null;
  createdAt: string;
}


// ---------------------------------------------------------------------------
// Dashboard / Report aggregates
// ---------------------------------------------------------------------------

export interface DailySalesSummary {
  date: string;             // YYYY-MM-DD
  totalRevenue: number;
  totalTransactions: number;
  cashRevenue: number;
  transferRevenue: number;
  qrisRevenue: number;
  creditRevenue: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  totalQty: number;
  totalRevenue: number;
  totalProfit: number;
}

export interface BranchSummary {
  branchId: string;
  branchName: string;
  totalRevenue: number;
  totalTransactions: number;
  stockAlerts: number;      // products below reorder point
}

export interface DashboardStats {
  todayRevenue: number;
  todayTransactions: number;
  todayGrossProfit: number;
  todayNetProfit: number;
  todayOpex: number;
  yesterdayRevenue: number;
  yesterdayTransactions: number;
  yesterdayGrossProfit: number;
  yesterdayNetProfit: number;
  weekRevenue: number;
  weekGrossProfit: number;
  weekNetProfit: number;
  monthRevenue: number;
  monthGrossProfit: number;
  monthNetProfit: number;
  monthOpex: number;
  totalAr: number;          // total outstanding receivables
  totalAp: number;          // total outstanding payables
  overdueAr: number;        // AR past due date
  lowStockCount: number;    // products at or below reorder point
  criticalStockCount: number;
  totalCashBalance: number;
  cashAccountCount: number;
  revenueChartData: DailySalesSummary[];
}

/** Single-branch slice returned by getDashboardBundle (Sprint 1 P0-2). */
export interface DashboardBranchBundle {
  branchId: string;
  stats: DashboardStats;
  topProducts30d: TopProduct[];
  topProductsToday: TopProduct[];
}

export interface DashboardBundle {
  branches: DashboardBranchBundle[];
}

/** Laporan agregat multi-cabang (Sprint 3 P1-2). */
export interface ReportsBundle {
  salesReport: {
    chart: { date: string; label: string; total: number; transactions: number }[];
    summary: { totalSales: number; totalTransactions: number; avgTicket: number };
  };
  topProducts: { sku: string; name: string; qty: number; revenue: number }[];
  paymentMethods: { name: string; value: number }[];
  profitLoss: {
    sales: number;
    salesMargin: number;
    cogs: number;
    grossProfit: number;
    opex: number;
    netProfit: number;
    marginPct: number;
    grossMarginPct: number;
  };
}

/** Badge sidebar modul operasional (Sprint 3 P1-5). */
export interface ModuleNavCounts {
  deliveries: number;
  sales_orders: number;
  online_orders: number;
}

export interface StockAlertItem {
  branchProductId: string;
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  branchId: string;
  branchName: string;
  stock: number;
  legacyStock: number;
  reorderPoint: number;
  stockStatus: StockStatus;
}


// ---------------------------------------------------------------------------
// Auth context types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string;
  isPlatformAdmin?: boolean;
  profile: AppProfile;
  activeBranchId: string | null;
  allowedBranchIds: string[];
  isOwner: boolean;
  isManager: boolean;
  isCashier: boolean;
  isWarehouse: boolean;
  isAccountant: boolean;
}

export interface RegisterInput {
  name: string;
  username: string;
  email?: string;
  password: string;
  confirmPassword: string;
  phone: string;
  address: {
    provinceCode: string;
    provinceName: string;
    regencyCode: string;
    regencyName: string;
    districtCode: string;
    districtName: string;
    villageCode: string;
    villageName: string;
    street: string;
  };
}

export interface GoogleSignInResult extends AuthUser {
  isNewUser?: boolean;
}

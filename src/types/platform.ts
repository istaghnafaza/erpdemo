// =============================================================================
// Platform admin API types
// =============================================================================

export interface PlatformTenantRow {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  phone: string | null;
  plan: string;
  trialEndsAt: string | null;
  planRenewsAt: string | null;
  isActive: boolean;
  onboardingComplete: boolean;
  createdAt: string;
  ownerName: string | null;
  activeBranchCount: number;
  activeUserCount: number;
  revenue30d: number;
  txCount30d: number;
}

export interface PlatformBillingKpis {
  activeTrials: number;
  trialToPaidConversion7dPct: number;
  mrr: number;
  pastDueCount: number;
  renewingWithin7d: number;
}

export interface PlatformOverview {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  onboardingPending: number;
  totalRevenue30d: number;
  totalTx30d: number;
  billing: PlatformBillingKpis;
}

export interface PlatformDashboardData {
  overview: PlatformOverview;
  tenants: PlatformTenantRow[];
}

export interface PlatformTenantAccessUpdate {
  tenantId: string;
  plan: "trial" | "basic" | "pro" | "enterprise";
  billingCycle?: "monthly" | "yearly";
  trialEndsAt?: string | null;
  planRenewsAt?: string | null;
  isActive: boolean;
  applyDefaultDates?: boolean;
}

export interface PlatformPriceCompareRow {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  branchId: string;
  branchName: string;
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  sellingPrice: number;
  stock: number;
}

export interface PlatformProductSupplierInfo {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  paymentTermDays: number;
  isActive: boolean;
  isPreferred: boolean;
  lastPurchasePrice: number | null;
  lastPoNumber: string | null;
  lastPoAt: string | null;
}

export interface PlatformProductSupplierPayload {
  tenantId: string;
  tenantName: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  purchasePrice: number;
  suppliers: PlatformProductSupplierInfo[];
}

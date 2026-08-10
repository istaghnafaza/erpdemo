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

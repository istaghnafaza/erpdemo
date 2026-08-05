// =============================================================================
// Bersihkan data demo/mock di browser sebelum setup toko Neon yang sebenarnya.
// =============================================================================

import { allowMockDataSeeding } from "@/lib/mock-data-guard";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import { useBranchStore } from "@/stores/branch.store";
import { useCustomerDeliverySitesStore } from "@/stores/customer-delivery-sites.store";
import { useCustomerPortalStore } from "@/stores/customer-portal.store";
import { useCustomersStore } from "@/stores/customers.store";
import { useDeliveriesStore } from "@/stores/deliveries.store";
import { useFinanceStore } from "@/stores/finance.store";
import { useInventoryStore } from "@/stores/inventory.store";
import { usePayablesStore } from "@/stores/payables.store";
import { usePosHeldCartsStore } from "@/stores/pos-held-carts.store";
import { usePosStore } from "@/stores/pos.store";
import { useProductAttributesStore } from "@/stores/product-attributes.store";
import { usePurchasingStore } from "@/stores/purchasing.store";
import { useReceivablesStore } from "@/stores/receivables.store";
import { useSalesOrdersStore } from "@/stores/sales-orders.store";
import { useSalesTransactionsStore } from "@/stores/sales-transactions.store";

/** Hapus sisa data demo di client — dipanggil sebelum wizard setup toko Neon. */
export function clearClientDemoDataForRealTenant(tenantId: string): void {
  if (allowMockDataSeeding() || tenantId === MOCK_TENANT_ID) return;

  useBranchStore.setState({
    onboardingBranches: [],
    activeBranch: null,
    isConsolidated: false,
    branches: [],
  });

  useInventoryStore.setState({
    mockStockAdjustments: {},
    mockMovements: [],
    mockTransfers: [],
    mockDeactivatedIds: {},
    mockProductOverrides: {},
    pendingOpnameApproval: false,
  });

  useCustomersStore.setState({ customers: [] });
  useSalesTransactionsStore.setState({ transactions: [] });
  useDeliveriesStore.setState({ deliveries: [] });
  useCustomerDeliverySitesStore.setState({ sites: [], lastUsedSiteByCustomer: {} });
  useProductAttributesStore.setState({
    catalogCategories: [],
    globalAttributes: [],
    productTypes: [],
    typeAttributes: [],
    seeded: false,
    seedVersion: 0,
    publishedVersion: 0,
    catalogReadOnly: true,
  });
  usePosHeldCartsStore.setState({ carts: [] });
  useSalesOrdersStore.setState({ mockOrders: [] });
  usePurchasingStore.setState({
    mockPurchaseOrders: [],
    mockGoodsReceipts: [],
    pendingGrPoId: null,
  });

  useFinanceStore.setState({
    mockCashAccounts: [],
    mockCashTransactions: [],
  });
  useReceivablesStore.setState({ mockReceivables: [], mockPayments: [] });
  usePayablesStore.setState({ mockPayables: [], mockPayments: [] });

  useCustomerPortalStore.setState({
    accounts: [],
    orders: [],
    sessionByTenant: {},
    cartsByTenant: {},
    branchByTenant: {},
  });

  usePosStore.getState().clearSession();
}

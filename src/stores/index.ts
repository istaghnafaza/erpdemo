// =============================================================================
// Stores — barrel export
//
// Usage in components:
//   import { useAuthStore, selectIsLoggedIn } from '@/stores'
//   import { usePosStore, selectActiveCart }   from '@/stores'
// =============================================================================

// Auth
export {
  useAuthStore,
  selectCurrentUser,
  selectCurrentTenant,
  selectIsLoggedIn,
  selectUserRole,
  selectTenantId,
  selectIsOwner,
  selectIsManager,
  selectIsCashier,
  selectAuthLoading,
  selectAuthError,
} from "./auth.store";

// Branch
export {
  useBranchStore,
  selectBranches,
  selectActiveBranch,
  selectActiveBranchId,
  selectIsConsolidated,
  selectBranchLoading,
  selectQueryBranchIds,
} from "./branch.store";

// POS
export {
  usePosStore,
  selectActiveSession,
  selectActiveCart,
  selectActiveCartIndex,
  selectAllCarts,
  selectIsProcessing,
  selectLastReceipt,
  selectSessionError,
  selectActiveCartTotal,
  selectActiveCartSubtotal,
  selectOccupiedCartCount,
} from "./pos.store";

export type { ActiveCart } from "./pos.store";

// Inventory
export { useInventoryStore, inventoryStockStatus } from "./inventory.store";
export type { StockStatusFilter, MockProductOverride } from "./inventory.store";

// Sales Orders
export {
  useSalesOrdersStore,
  soStatusLabel,
  soStatusKind,
  canEditSalesOrder,
  getSoItemEditMeta,
} from "./sales-orders.store";
export type {
  CreateSoDraft,
  CreateSoItemDraft,
  UpdateSoDraft,
  UpdateSoItemDraft,
} from "./sales-orders.store";

// Purchasing
export {
  usePurchasingStore,
  poStatusLabel,
  poStatusKind,
  poTypeLabel,
} from "./purchasing.store";
export type { CreatePoDraft, CreatePoItemDraft } from "./purchasing.store";

// Finance
export { useFinanceStore } from "./finance.store";
export type { RecordExpenseDraft, RecordIncomeDraft, RecordSaleCogsDraft } from "./finance.store";

// Receivables
export { useReceivablesStore } from "./receivables.store";
export type { RecordCreditSaleDraft, RecordArPaymentDraft } from "./receivables.store";

// Payables
export { usePayablesStore } from "./payables.store";
export type { RecordApPaymentDraft } from "./payables.store";

// Onboarding
export { useOnboardingStore } from "./onboarding.store";
export type { OnboardingPath } from "./onboarding.store";

export { useUsersStore } from "./users.store";

// Offline
export {
  useOfflineStore,
  initOfflineListeners,
  selectIsOnline,
  selectPendingCount,
  selectSyncStatus,
  selectLastSyncAt,
  selectTxQueue,
  selectFailedTx,
} from "./offline.store";

export type { QueuedTransaction } from "./offline.store";

// Notifications
export {
  useNotificationStore,
  selectNotifications,
  selectUnreadCount,
  selectIsConnected,
  selectByType,
} from "./notification.store";

export type { AppNotification, NotificationType } from "./notification.store";

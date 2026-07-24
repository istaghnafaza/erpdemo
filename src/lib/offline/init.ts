// =============================================================================
// Offline bootstrap — cache refresh on login / reconnect (Fase 15).
// =============================================================================

import {
  refreshCache,
  refreshCacheOnReconnect,
  startCacheRefreshInterval,
  stopCacheRefreshInterval,
} from "@/lib/offline/cache";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";

let cacheListenersAttached = false;

export function initOfflineCache(): void {
  if (typeof window === "undefined" || cacheListenersAttached) return;
  cacheListenersAttached = true;

  const tryRefresh = () => {
    const tenantId = useAuthStore.getState().currentUser?.tenantId;
    const branchId = useBranchStore.getState().activeBranch?.id;
    if (!tenantId || !branchId) return;
    void refreshCache(tenantId, branchId).catch(() => undefined);
    startCacheRefreshInterval(tenantId, branchId);
  };

  window.addEventListener("online", () => {
    const tenantId = useAuthStore.getState().currentUser?.tenantId;
    const branchId = useBranchStore.getState().activeBranch?.id;
    if (tenantId && branchId) {
      void refreshCacheOnReconnect(tenantId, branchId);
    }
    // syncQueue dipanggil oleh initOfflineListeners → setOnline(true)
  });

  tryRefresh();

  useAuthStore.subscribe((state, prev) => {
    if (state.currentUser?.tenantId && state.currentUser.tenantId !== prev.currentUser?.tenantId) {
      tryRefresh();
    }
  });

  useBranchStore.subscribe((state, prev) => {
    if (state.activeBranch?.id && state.activeBranch.id !== prev.activeBranch?.id) {
      tryRefresh();
    }
  });
}

export function teardownOfflineCache(): void {
  stopCacheRefreshInterval();
}

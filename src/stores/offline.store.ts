// =============================================================================
// Offline Store — offline transaction queue with IndexedDB persistence (Fase 15).
// =============================================================================

import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { persistQueue, loadQueue } from "@/lib/offline/idb";
import { syncOfflineQueue, type SyncProgress } from "@/lib/offline/sync";
import type { SalesTransactionInsert, SalesItemInsert } from "@/types/database";

export interface QueuedTransaction {
  localId: string;
  tenantId: string;
  branchId: string;
  sessionId: string | null;
  offlineCreatedAt: string;
  transaction: Omit<SalesTransactionInsert, "tenant_id">;
  items: Omit<SalesItemInsert, "transaction_id" | "tenant_id">[];
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  retryCount: number;
  lastRetryAt: string | null;
  serverTxId: string | null;
  errorMessage: string | null;
}

const LEGACY_IDB_KEY = "ses-offline-queue";
const SYNC_FEEDBACK_MS = 4000;
const MIN_SYNC_VISIBLE_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface OfflineState {
  isOnline: boolean;
  txQueue: QueuedTransaction[];
  syncStatus: "idle" | "syncing" | "error" | "success";
  syncProgress: SyncProgress | null;
  syncMessage: string | null;
  lastSyncAt: string | null;
  pendingCount: number;

  setOnline(status: boolean): void;
  addToQueue(
    tx: Omit<
      QueuedTransaction,
      "syncStatus" | "retryCount" | "lastRetryAt" | "serverTxId" | "errorMessage"
    >,
  ): Promise<void>;
  syncQueue(options?: { retryFailed?: boolean }): Promise<void>;
  clearSynced(): Promise<void>;
  hydrate(): Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  txQueue: [],
  syncStatus: "idle",
  syncProgress: null,
  syncMessage: null,
  lastSyncAt: null,
  pendingCount: 0,

  setOnline: (status) => {
    set({ isOnline: status });
    if (status) void get().syncQueue();
  },

  addToQueue: async (tx) => {
    const item: QueuedTransaction = {
      ...tx,
      syncStatus: "pending",
      retryCount: 0,
      lastRetryAt: null,
      serverTxId: null,
      errorMessage: null,
    };

    const newQueue = [...get().txQueue, item];
    const pendingCount = newQueue.filter((t) => t.syncStatus === "pending").length;
    set({ txQueue: newQueue, pendingCount, syncMessage: null });
    await persistQueue(newQueue);
    await idbSet(LEGACY_IDB_KEY, newQueue);
  },

  syncQueue: async (options?: { retryFailed?: boolean }) => {
    const { txQueue, syncStatus, isOnline } = get();
    if (!isOnline || syncStatus === "syncing") return;

    const queueForSync =
      options?.retryFailed === true
        ? txQueue.map((t) =>
            t.syncStatus === "failed"
              ? {
                  ...t,
                  syncStatus: "pending" as const,
                  retryCount: 0,
                  errorMessage: null,
                }
              : t,
          )
        : txQueue;

    const pending = queueForSync.filter((t) => t.syncStatus === "pending");
    if (pending.length === 0) return;

    if (queueForSync !== txQueue) {
      set({ txQueue: queueForSync });
    }

    set({
      syncStatus: "syncing",
      syncProgress: { current: 0, total: pending.length },
      syncMessage: null,
    });

    const syncStartedAt = Date.now();

    const result = await syncOfflineQueue(queueForSync, (progress) => {
      set({ syncProgress: progress });
    });

    const elapsed = Date.now() - syncStartedAt;
    if (elapsed < MIN_SYNC_VISIBLE_MS) {
      await sleep(MIN_SYNC_VISIBLE_MS - elapsed);
    }

    const pendingCount = result.updatedQueue.filter((t) => t.syncStatus === "pending").length;
    const failed = result.updatedQueue.filter((t) => t.syncStatus === "failed");

    let nextSyncMessage: string | null = null;
    let nextSyncStatus: OfflineState["syncStatus"] = "success";

    if (result.hasError) {
      nextSyncStatus = "error";
      nextSyncMessage =
        failed.length > 0
          ? `Gagal sync ${failed.length} transaksi — ketuk Coba Lagi`
          : "Beberapa transaksi gagal disinkronkan";
    } else if (result.syncedCount > 0) {
      nextSyncMessage = `✅ ${result.syncedCount} transaksi tersinkron`;
      nextSyncStatus = "success";
    }

    set({
      txQueue: result.updatedQueue,
      syncStatus: nextSyncStatus,
      syncProgress: null,
      syncMessage: nextSyncMessage,
      lastSyncAt: new Date().toISOString(),
      pendingCount,
    });

    await persistQueue(result.updatedQueue);
    await idbSet(LEGACY_IDB_KEY, result.updatedQueue);

    if (nextSyncStatus === "success" && pendingCount === 0) {
      setTimeout(async () => {
        await get().clearSynced();
        set({ syncMessage: null, syncStatus: "idle" });
      }, SYNC_FEEDBACK_MS);
    }
  },

  clearSynced: async () => {
    const filtered = get().txQueue.filter((t) => t.syncStatus !== "synced");
    set({
      txQueue: filtered,
      pendingCount: filtered.filter((t) => t.syncStatus === "pending").length,
    });
    await persistQueue(filtered);
    await idbSet(LEGACY_IDB_KEY, filtered);
  },

  hydrate: async () => {
    try {
      let queue = await loadQueue<QueuedTransaction>();
      if (queue.length === 0) {
        queue = (await idbGet<QueuedTransaction[]>(LEGACY_IDB_KEY)) ?? [];
      }

      const reset = queue.map((t) =>
        t.syncStatus === "syncing" ? { ...t, syncStatus: "pending" as const } : t,
      );
      const pendingCount = reset.filter((t) => t.syncStatus === "pending").length;
      set({ txQueue: reset, pendingCount });

      if (get().isOnline && pendingCount > 0) {
        void get().syncQueue();
      }
    } catch {
      // IndexedDB unavailable — ignore
    }
  },
}));

let listenersAttached = false;
let onlinePollTimer: ReturnType<typeof setInterval> | null = null;

export function initOfflineListeners() {
  if (typeof window === "undefined" || listenersAttached) return;
  listenersAttached = true;

  const syncNavigatorOnline = () => {
    const online = navigator.onLine;
    const { isOnline } = useOfflineStore.getState();
    if (online !== isOnline) {
      useOfflineStore.getState().setOnline(online);
    }
  };

  window.addEventListener("online", () => useOfflineStore.getState().setOnline(true));
  window.addEventListener("offline", () => useOfflineStore.getState().setOnline(false));

  // DevTools Network throttling kadang tidak memicu event online/offline.
  onlinePollTimer = setInterval(syncNavigatorOnline, 1500);
  syncNavigatorOnline();

  void useOfflineStore.getState().hydrate();
}

export const selectIsOnline = (s: OfflineState) => s.isOnline;
export const selectPendingCount = (s: OfflineState) => s.pendingCount;
export const selectSyncStatus = (s: OfflineState) => s.syncStatus;
export const selectSyncProgress = (s: OfflineState) => s.syncProgress;
export const selectSyncMessage = (s: OfflineState) => s.syncMessage;
export const selectLastSyncAt = (s: OfflineState) => s.lastSyncAt;
export const selectTxQueue = (s: OfflineState) => s.txQueue;
export const selectFailedTx = (s: OfflineState) =>
  s.txQueue.filter((t) => t.syncStatus === "failed");

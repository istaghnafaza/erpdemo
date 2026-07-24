// =============================================================================
// Offline sync — bulk queue sync + reconciliation flags (Fase 15).
// =============================================================================

import { createTransaction } from "@/lib/api/transactions";
import { isNeonBackend } from "@/lib/api/backend";
import { recordSyncBatch } from "@/lib/offline/sync-metrics";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import type { QueuedTransaction } from "@/stores/offline.store";
import { useNotificationStore } from "@/stores/notification.store";

/** Demo tenant (mock backend only): sesi POS in-memory, tidak ada di DB. */
function isMockOfflineItem(item: QueuedTransaction): boolean {
  if (item.tenantId === MOCK_TENANT_ID && !isNeonBackend()) return true;
  const sessionId = item.transaction.session_id;
  return typeof sessionId === "string" && sessionId.startsWith("mock-session-");
}

export interface SyncProgress {
  current: number;
  total: number;
}

export interface SyncResult {
  updatedQueue: QueuedTransaction[];
  syncedCount: number;
  failedCount: number;
  hasError: boolean;
  alerts: string[];
}

const MAX_RETRY = 3;

export async function syncOfflineQueue(
  txQueue: QueuedTransaction[],
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncResult> {
  const pending = txQueue.filter(
    (t) => t.syncStatus === "pending" && t.retryCount < MAX_RETRY,
  );

  if (pending.length === 0) {
    return {
      updatedQueue: txQueue,
      syncedCount: 0,
      failedCount: 0,
      hasError: false,
      alerts: [],
    };
  }

  const updatedQueue = [...txQueue];
  const alerts: string[] = [];
  let syncedCount = 0;
  let failedCount = 0;
  let hasError = false;
  let current = 0;

  for (const item of pending) {
    current++;
    onProgress?.({ current, total: pending.length });

    const idx = updatedQueue.findIndex((t) => t.localId === item.localId);
    if (idx === -1) continue;

    updatedQueue[idx] = { ...updatedQueue[idx], syncStatus: "syncing" };

    try {
      // Mock/demo: stok & keuangan sudah di-update saat checkout offline.
      // Tidak ada JWT Supabase — insert ke DB pasti gagal (400 FK / invalid UUID).
      if (isMockOfflineItem(item)) {
        updatedQueue[idx] = {
          ...updatedQueue[idx],
          syncStatus: "synced",
          serverTxId: item.localId,
          errorMessage: null,
        };
        syncedCount++;
        continue;
      }

      const result = await createTransaction(
        item.tenantId,
        {
          ...item.transaction,
          client_tx_id: item.localId,
          is_offline_transaction: true,
          offline_created_at: item.offlineCreatedAt,
          sync_status: "synced",
        },
        item.items,
      );

      if (result.error) {
        const msg = result.error.toUpperCase();
        if (msg.includes("STOCK_DEFICIT")) {
          alerts.push(`Stok tidak cukup saat sync: ${item.transaction.transaction_number}`);
        }
        if (msg.includes("CREDIT_EXCEEDED")) {
          alerts.push(`Limit kredit terlampaui: ${item.transaction.transaction_number}`);
        }
        throw new Error(result.error);
      }

      updatedQueue[idx] = {
        ...updatedQueue[idx],
        syncStatus: "synced",
        serverTxId: result.data!.id,
        errorMessage: null,
      };
      syncedCount++;
    } catch (err) {
      const retryCount = (updatedQueue[idx].retryCount ?? 0) + 1;
      updatedQueue[idx] = {
        ...updatedQueue[idx],
        syncStatus: retryCount >= MAX_RETRY ? "failed" : "pending",
        retryCount,
        lastRetryAt: new Date().toISOString(),
        errorMessage: err instanceof Error ? err.message : "Sync gagal",
      };
      failedCount++;
      hasError = true;
    }
  }

  for (const msg of alerts) {
    useNotificationStore.getState().addNotification({
      type: "reconciliation",
      title: "Alert Rekonsiliasi",
      message: msg,
      branchId: null,
      entityId: null,
      entityType: "reconciliation_alert",
    });
  }

  if (syncedCount > 0 || failedCount > 0) {
    recordSyncBatch(syncedCount, failedCount);
  }

  return { updatedQueue, syncedCount, failedCount, hasError, alerts };
}

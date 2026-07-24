// =============================================================================
// Offline sync metrics — KPI monitoring (Phase 6)
// =============================================================================

export interface SyncMetrics {
  totalAttempts: number;
  successCount: number;
  failedCount: number;
  lastRunAt: string | null;
  /** Success rate of the most recent sync batch (0–1) */
  lastBatchSuccessRate: number;
}

const STORAGE_KEY = "ses-sync-metrics";

const EMPTY: SyncMetrics = {
  totalAttempts: 0,
  successCount: 0,
  failedCount: 0,
  lastRunAt: null,
  lastBatchSuccessRate: 1,
};

export function getSyncMetrics(): SyncMetrics {
  if (typeof localStorage === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

export function recordSyncBatch(syncedCount: number, failedCount: number): SyncMetrics {
  const prev = getSyncMetrics();
  const batchTotal = syncedCount + failedCount;
  const next: SyncMetrics = {
    totalAttempts: prev.totalAttempts + batchTotal,
    successCount: prev.successCount + syncedCount,
    failedCount: prev.failedCount + failedCount,
    lastRunAt: new Date().toISOString(),
    lastBatchSuccessRate: batchTotal > 0 ? syncedCount / batchTotal : prev.lastBatchSuccessRate,
  };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

/** Overall success rate since first sync (target ≥ 99.5%) */
export function getSyncSuccessRate(): number {
  const m = getSyncMetrics();
  if (m.totalAttempts === 0) return 1;
  return m.successCount / m.totalAttempts;
}

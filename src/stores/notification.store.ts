// =============================================================================
// Notification Store — in-app notifications (Supabase Realtime or API polling)
//
// Sources:
//   1. Supabase Realtime (supabase backend only)
//   2. API polling every 5 minutes (neon + supabase fallback)
//   3. Manual dispatch from anywhere in the app (e.g., offline sync failures)
// =============================================================================

import { create } from "zustand";
import { isSupabaseBackend } from "@/lib/api/backend";
import { getReceivables } from "@/lib/api/receivables";
import { getPayables } from "@/lib/api/payables";
import { getStockAlerts } from "@/lib/api/reports";

// ---------------------------------------------------------------------------
// Notification shape
// ---------------------------------------------------------------------------

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "stock_alert"
  | "reconciliation"
  | "sync_failed"
  | "ar_overdue"
  | "ap_due";

export interface AppNotification {
  id:          string;
  type:        NotificationType;
  title:       string;
  message:     string;
  isRead:      boolean;
  isDismissed: boolean;
  branchId:    string | null;
  entityId:    string | null;
  entityType:  string | null;
  createdAt:   string;
}

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

type RealtimeChannelLike = { unsubscribe: () => void | Promise<void> };

interface NotificationState {
  notifications: AppNotification[];
  unreadCount:   number;
  isConnected:   boolean;
  isPanelOpen:   boolean;

  _channel:   RealtimeChannelLike | null;
  _pollTimer: ReturnType<typeof setInterval> | null;

  addNotification(n: Omit<AppNotification, "id" | "isRead" | "isDismissed" | "createdAt">): void;
  markRead(id: string): void;
  markAllRead(): void;
  dismissNotification(id: string): void;
  clearAll(): void;
  openPanel(): void;
  closePanel(): void;
  setPanelOpen(open: boolean): void;
  subscribe(tenantId: string, branchId: string): void;
  unsubscribe(): void;
}

let _notifCounter = 0;
function makeId() {
  return `notif-${Date.now()}-${++_notifCounter}`;
}

function computeUnread(notifications: AppNotification[]): number {
  return notifications.filter((n) => !n.isRead && !n.isDismissed).length;
}

const MAX_NOTIFICATIONS = 100;
const POLL_INTERVAL_MS = 5 * 60 * 1000;

type SetState = (
  partial: Partial<NotificationState> | ((s: NotificationState) => Partial<NotificationState>),
) => void;

function startPollTimer(tenantId: string, branchId: string, get: () => NotificationState, set: SetState) {
  const existing = get()._pollTimer;
  if (existing) clearInterval(existing);

  const timer = setInterval(
    () => void pollNotifications(tenantId, branchId),
    POLL_INTERVAL_MS,
  );

  void pollNotifications(tenantId, branchId);
  set({ _pollTimer: timer, isConnected: true });
}

async function subscribeSupabaseRealtime(
  tenantId: string,
  branchId: string,
  addNotification: NotificationState["addNotification"],
  set: SetState,
) {
  const { supabase } = await import("@/lib/supabase");

  const channel = supabase
    .channel(`tenant-${tenantId}-branch-${branchId}`)
    .on(
      "postgres_changes",
      {
        event:  "INSERT",
        schema: "public",
        table:  "reconciliation_alerts",
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload) => {
        const row = payload.new as { id: string; total_flagged: number; branch_id: string };
        addNotification({
          type:       "reconciliation",
          title:      "Peringatan Rekonsiliasi",
          message:    `${row.total_flagged} transaksi membutuhkan perhatian`,
          branchId:   row.branch_id,
          entityId:   row.id,
          entityType: "reconciliation_alert",
        });
      },
    )
    .on(
      "postgres_changes",
      {
        event:  "UPDATE",
        schema: "public",
        table:  "offline_tx_queue",
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload) => {
        const row = payload.new as { local_id: string; sync_status: string; branch_id: string };
        if (row.sync_status === "failed") {
          addNotification({
            type:       "sync_failed",
            title:      "Sync Offline Gagal",
            message:    `Transaksi offline (${row.local_id.slice(0, 8)}) gagal disinkronkan`,
            branchId:   row.branch_id,
            entityId:   row.local_id,
            entityType: "offline_tx",
          });
        }
      },
    )
    .subscribe((status) => {
      set({ isConnected: status === "SUBSCRIBED" });

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        startPollTimer(tenantId, branchId, useNotificationStore.getState, set);
      }
    });

  return channel;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount:   0,
  isConnected:   false,
  isPanelOpen:   false,
  _channel:      null,
  _pollTimer:    null,

  addNotification: (n) => {
    const newNotif: AppNotification = {
      ...n,
      id:          makeId(),
      isRead:      false,
      isDismissed: false,
      createdAt:   new Date().toISOString(),
    };

    set((state) => {
      const all = [newNotif, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      return { notifications: all, unreadCount: computeUnread(all) };
    });
  },

  markRead: (id) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      );
      return { notifications, unreadCount: computeUnread(notifications) };
    });
  },

  markAllRead: () => {
    set((state) => {
      const notifications = state.notifications.map((n) => ({ ...n, isRead: true }));
      return { notifications, unreadCount: 0 };
    });
  },

  dismissNotification: (id) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, isDismissed: true, isRead: true } : n,
      );
      return { notifications, unreadCount: computeUnread(notifications) };
    });
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  setPanelOpen: (open) => set({ isPanelOpen: open }),

  subscribe: (tenantId, branchId) => {
    get().unsubscribe();

    const { addNotification } = get();

    if (isSupabaseBackend()) {
      void subscribeSupabaseRealtime(tenantId, branchId, addNotification, set).then((channel) => {
        set({ _channel: channel });
      });
    }

    startPollTimer(tenantId, branchId, get, set);
  },

  unsubscribe: () => {
    const { _channel, _pollTimer } = get();
    if (_channel) void _channel.unsubscribe();
    if (_pollTimer) clearInterval(_pollTimer);
    set({ _channel: null, _pollTimer: null, isConnected: false });
  },
}));

async function pollNotifications(tenantId: string, branchId: string) {
  const { addNotification } = useNotificationStore.getState();
  const today = new Date().toISOString().split("T")[0];
  const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    const overdueAr = await getReceivables(tenantId, branchId, { overdueOnly: true });
    if (!overdueAr.error && overdueAr.data) {
      for (const ar of overdueAr.data.slice(0, 5)) {
        const existing = useNotificationStore.getState().notifications.find(
          (n) => n.entityId === ar.id && n.entityType === "ar" && !n.isDismissed,
        );
        if (existing) continue;

        addNotification({
          type:       "ar_overdue",
          title:      "Piutang Jatuh Tempo",
          message:    `${ar.invoice_number} — ${ar.customer_name} belum dibayar`,
          branchId,
          entityId:   ar.id,
          entityType: "ar",
        });
      }
    }

    const payables = await getPayables(tenantId, branchId);
    if (!payables.error && payables.data) {
      const dueSoonAp = payables.data.filter(
        (ap) =>
          (ap.status === "unpaid" || ap.status === "partial") &&
          ap.due_date >= today &&
          ap.due_date <= in3Days,
      );

      for (const ap of dueSoonAp.slice(0, 5)) {
        const existing = useNotificationStore.getState().notifications.find(
          (n) => n.entityId === ap.id && n.entityType === "ap" && !n.isDismissed,
        );
        if (existing) continue;

        addNotification({
          type:       "ap_due",
          title:      "Hutang Segera Jatuh Tempo",
          message:    `${ap.invoice_number} — ${ap.supplier_name} jatuh tempo ${ap.due_date}`,
          branchId,
          entityId:   ap.id,
          entityType: "ap",
        });
      }
    }

    const stockAlerts = await getStockAlerts(tenantId, branchId);
    if (!stockAlerts.error && stockAlerts.data) {
      for (const alert of stockAlerts.data.filter((a) => a.stockStatus === "critical").slice(0, 5)) {
        const existing = useNotificationStore.getState().notifications.find(
          (n) => n.entityId === alert.branchProductId && n.entityType === "branch_product" && !n.isDismissed,
        );
        if (existing) continue;

        addNotification({
          type:       "stock_alert",
          title:      "Stok Kritis",
          message:    `${alert.productName} (${alert.sku}) — stok tersisa ${alert.stock}`,
          branchId,
          entityId:   alert.branchProductId,
          entityType: "branch_product",
        });
      }
    }
  } catch {
    // Polling errors are non-fatal
  }
}

export const selectNotifications  = (s: NotificationState) => s.notifications.filter((n) => !n.isDismissed);
export const selectUnreadCount    = (s: NotificationState) => s.unreadCount;
export const selectIsConnected    = (s: NotificationState) => s.isConnected;
export const selectByType         = (type: NotificationType) => (s: NotificationState) =>
  s.notifications.filter((n) => n.type === type && !n.isDismissed);

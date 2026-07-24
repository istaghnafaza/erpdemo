// =============================================================================
// Mock notification seeding — demo/mock sessions have no real Supabase Auth
// session, so RLS silently returns zero rows for the Realtime + polling
// notification checks in notification.store.ts. This seeds the same store
// with data derived from src/lib/mock-data.ts so the NotificationPanel has
// something realistic to show in demo mode.
// =============================================================================

import { useNotificationStore } from "@/stores/notification.store";
import {
  PRODUCTS,
  RECEIVABLES,
  PAYABLES,
  CUSTOMERS,
  SUPPLIERS,
  stockStatus,
} from "@/lib/mock-data";
import { daysBetween } from "@/lib/format";

let seeded = false;

export function seedMockNotifications(branchId: string) {
  if (seeded) return;
  seeded = true;

  const { addNotification, notifications } = useNotificationStore.getState();
  if (notifications.length > 0) return;

  for (const p of PRODUCTS.filter((p) => stockStatus(p) === "critical")) {
    addNotification({
      type: "stock_alert",
      title: "Stok Kritis",
      message: `${p.name} — stok tersisa ${p.stock} ${p.unit} (min ${p.minStock})`,
      branchId,
      entityId: p.sku,
      entityType: "branch_product",
    });
  }

  const today = new Date().toISOString();
  for (const r of RECEIVABLES) {
    const remaining = r.amount - r.paid;
    if (remaining <= 0) continue;
    const daysLate = daysBetween(today, r.dueDate);
    if (daysLate <= 0) continue;
    const customer = CUSTOMERS.find((c) => c.id === r.customerId);
    addNotification({
      type: "ar_overdue",
      title: "Piutang Jatuh Tempo",
      message: `${r.invoice} — ${customer?.name ?? "Pelanggan"} terlambat ${daysLate} hari`,
      branchId,
      entityId: r.id,
      entityType: "ar",
    });
  }

  for (const p of PAYABLES) {
    const remaining = p.amount - p.paid;
    if (remaining <= 0) continue;
    const daysUntil = daysBetween(p.dueDate, today);
    if (daysUntil > 3) continue;
    const supplier = SUPPLIERS.find((s) => s.id === p.supplierId);
    addNotification({
      type: "ap_due",
      title: daysUntil < 0 ? "Hutang Terlambat" : "Hutang Segera Jatuh Tempo",
      message: `${p.invoice} — ${supplier?.name ?? "Supplier"} jatuh tempo ${new Date(p.dueDate).toLocaleDateString("id-ID")}`,
      branchId,
      entityId: p.id,
      entityType: "ap",
    });
  }
}

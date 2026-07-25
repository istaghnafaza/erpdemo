// =============================================================================
// Guard — mock/demo seeding hanya untuk sesi demo lokal, bukan tenant Neon.
// =============================================================================

import { isNeonBackend } from "@/lib/api/backend";
import { isDemoQuickLoginEnabled } from "@/lib/mock-session";

/** Izinkan seed data demo ke localStorage / Zustand (bukan tenant produksi Neon). */
export function allowMockDataSeeding(): boolean {
  if (!isNeonBackend()) return true;
  return isDemoQuickLoginEnabled();
}

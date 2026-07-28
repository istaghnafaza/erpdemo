// =============================================================================
// Guard — mock/demo seeding hanya untuk backend mock (local dev), bukan Neon.
// =============================================================================

import { isNeonBackend } from "@/lib/api/backend";

/** Izinkan seed data demo ke localStorage / Zustand (bukan tenant produksi Neon). */
export function allowMockDataSeeding(): boolean {
  return !isNeonBackend();
}

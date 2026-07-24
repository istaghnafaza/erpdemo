// =============================================================================
// Mock IDs — shared constants without store imports (avoids circular deps).
// Must match `supabase/migrations/003_seed_data.sql`.
// =============================================================================

export const MOCK_TENANT_ID = "11111111-0000-0000-0000-000000000001";

export const MOCK_BRANCH_SUDIRMAN = "22221111-0000-0000-0000-000000000001";
export const MOCK_BRANCH_KEBONJERUK = "22221111-0000-0000-0000-000000000002";
export const MOCK_BRANCH_BEKASI = "22221111-0000-0000-0000-000000000003";
/** Cabang pertama yang dibuat lewat wizard onboarding (demo). */
export const MOCK_BRANCH_ONBOARDING = "22221111-0000-0000-0000-0000000999";

export const MOCK_BRANCH_IDS = [
  MOCK_BRANCH_SUDIRMAN,
  MOCK_BRANCH_KEBONJERUK,
  MOCK_BRANCH_BEKASI,
] as const;

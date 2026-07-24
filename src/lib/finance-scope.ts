// =============================================================================
// Finance scope — filter data per cabang atau konsolidasi (semua cabang).
// =============================================================================

import type { Branch } from "@/types/database";

export function filterFinanceByBranches<T extends { branch_id: string }>(
  items: T[],
  branchIds: string[],
): T[] {
  if (branchIds.length === 0) return [];
  return items.filter((item) => branchIds.includes(item.branch_id));
}

export function getFinanceScopeLabel(
  isConsolidated: boolean,
  activeBranch: Branch | null,
): string {
  if (isConsolidated) return "Semua Cabang (Konsolidasi)";
  return activeBranch?.name ?? "Pilih cabang";
}

// =============================================================================
// Server cache key builders (Sprint 2 — P0-3)
// =============================================================================

const PREFIX = "seps";

export function branchProductsKey(tenantId: string, branchId: string): string {
  return `${PREFIX}:bp:${tenantId}:${branchId}`;
}

export function branchProductsMultiKey(tenantId: string, branchIds: readonly string[]): string {
  const sorted = [...branchIds].sort().join(",");
  return `${PREFIX}:bp-multi:${tenantId}:${sorted}`;
}

export function categoriesKey(tenantId: string): string {
  return `${PREFIX}:cat:${tenantId}`;
}

export function customersKey(tenantId: string): string {
  return `${PREFIX}:cust:${tenantId}`;
}

export function branchesKey(tenantId: string, activeOnly = false): string {
  return `${PREFIX}:br:${tenantId}:${activeOnly ? "active" : "all"}`;
}

export function branchesWithManagerKey(tenantId: string): string {
  return `${PREFIX}:br-mgr:${tenantId}`;
}

export function suppliersKey(tenantId: string, activeOnly = false): string {
  return `${PREFIX}:sup:${tenantId}:${activeOnly ? "active" : "all"}`;
}

export function branchesPrefix(tenantId: string): string {
  return `${PREFIX}:br:${tenantId}:`;
}

export function tenantBranchProductsPrefix(tenantId: string): string {
  return `${PREFIX}:bp:${tenantId}:`;
}

export function tenantBranchProductsMultiPrefix(tenantId: string): string {
  return `${PREFIX}:bp-multi:${tenantId}:`;
}

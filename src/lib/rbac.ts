// =============================================================================
// RBAC — role-based access control (Fase 16).
// =============================================================================

import type { UserRole } from "@/types/app";

export type RbacFeature =
  | "dashboard"
  | "pos"
  | "inventory"
  | "sales_orders"
  | "finance"
  | "receivables"
  | "payables"
  | "purchasing"
  | "reports"
  | "reports_profit_loss"
  | "reports_cashier_audit"
  | "purchase_price"
  | "product_edit"
  | "opname_approve"
  | "expense_record"
  | "users"
  | "sales_history"
  | "deliveries"
  | "customers"
  | "online_orders"
  | "settings"
  | "pricing_rules"
  | "toko_saya";

const ACCESS_MATRIX: Record<RbacFeature, UserRole[]> = {
  dashboard: ["owner", "manager"],
  pos: ["owner", "manager", "cashier"],
  inventory: ["owner", "manager", "warehouse"],
  sales_orders: ["owner", "manager", "warehouse"],
  finance: ["owner", "manager", "accountant"],
  receivables: ["owner", "manager", "accountant"],
  payables: ["owner", "manager", "accountant"],
  purchasing: ["owner", "manager", "warehouse"],
  reports: ["owner", "manager", "accountant"],
  reports_profit_loss: ["owner", "accountant"],
  reports_cashier_audit: ["owner", "manager"],
  purchase_price: ["owner", "manager", "warehouse", "accountant"],
  product_edit: ["owner", "manager", "warehouse"],
  opname_approve: ["owner", "manager"],
  expense_record: ["owner", "manager", "accountant"],
  users: ["owner"],
  sales_history: ["owner", "manager", "accountant", "cashier"],
  deliveries: ["owner", "manager", "cashier", "warehouse"],
  customers: ["owner", "manager", "accountant"],
  online_orders: ["owner", "manager", "cashier"],
  settings: ["owner", "manager"],
  pricing_rules: ["owner", "manager"],
  toko_saya: ["owner"],
};

const EDIT_MATRIX: Partial<Record<RbacFeature, UserRole[]>> = {
  inventory: ["owner", "manager", "warehouse"],
  sales_orders: ["owner", "manager"],
  purchasing: ["owner", "manager", "warehouse"],
  finance: ["owner", "manager", "accountant"],
  receivables: ["owner", "manager", "accountant"],
  payables: ["owner", "manager", "accountant"],
  deliveries: ["owner", "manager", "warehouse"],
  customers: ["owner", "manager"],
  online_orders: ["owner", "manager"],
  settings: ["owner", "manager"],
  pricing_rules: ["owner", "manager"],
  toko_saya: ["owner"],
};

const APPROVE_MATRIX: Partial<Record<RbacFeature, UserRole[]>> = {
  opname_approve: ["owner", "manager"],
  purchasing: ["owner", "manager"],
  sales_orders: ["owner", "manager"],
};

export function canAccess(role: UserRole | string | undefined, feature: RbacFeature): boolean {
  if (!role) return false;
  return ACCESS_MATRIX[feature]?.includes(role as UserRole) ?? false;
}

export function canEdit(role: UserRole | string | undefined, feature: RbacFeature): boolean {
  if (!role) return false;
  const editors = EDIT_MATRIX[feature];
  if (editors) return editors.includes(role as UserRole);
  return canAccess(role, feature);
}

export function canApprove(role: UserRole | string | undefined, feature: RbacFeature): boolean {
  if (!role) return false;
  const approvers = APPROVE_MATRIX[feature];
  if (!approvers) return false;
  return approvers.includes(role as UserRole);
}

export function rolesForFeature(feature: RbacFeature): UserRole[] {
  return ACCESS_MATRIX[feature] ?? [];
}

export function canSeePurchasePrice(role: UserRole | string | undefined): boolean {
  return canAccess(role, "purchase_price");
}

export function canEditProducts(role: UserRole | string | undefined): boolean {
  return canEdit(role, "product_edit");
}

/** Keuntungan & margin di histori penjualan — hanya owner & manager. */
export function canViewSalesMargin(role: UserRole | string | undefined): boolean {
  return role === "owner" || role === "manager";
}

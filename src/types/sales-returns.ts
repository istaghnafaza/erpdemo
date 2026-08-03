// =============================================================================
// Sales returns — types
// =============================================================================

export type SalesReturnStatus =
  | "pending_qc"
  | "qc_completed"
  | "pending_approval"
  | "pending_offset"
  | "completed"
  | "rejected"
  | "cancelled";

export type SalesReturnSettlement = "standalone_refund" | "offset_in_new_sale";

export type SalesReturnRefundMethod = "cash" | "transfer" | "credit_adjust";

export interface SalesReturnItemRecord {
  id: string;
  returnId: string;
  originalSalesItemId: string;
  productId: string | null;
  productName: string;
  sku: string;
  unit: string;
  qtySold: number;
  qtyRequested: number;
  qtyQcPassed: number;
  unitRefundPrice: number;
  refundSubtotal: number;
  qcPassed: boolean | null;
  qcRejectReason: string | null;
  stockSource: string;
  isNonReturnable: boolean;
}

export interface SalesReturnRecord {
  id: string;
  tenantId: string;
  branchId: string;
  returnNumber: string;
  originalTransactionId: string;
  originalTransactionNumber: string;
  customerId: string | null;
  customerName: string | null;
  status: SalesReturnStatus;
  settlement: SalesReturnSettlement | null;
  isLateReturn: boolean;
  refundMethod: SalesReturnRefundMethod | null;
  requestedRefundAmount: number;
  approvedRefundAmount: number;
  offsetTransactionId: string | null;
  reasonNotes: string | null;
  requestedBy: string | null;
  requestedAt: string;
  qcBy: string | null;
  qcAt: string | null;
  qcNotes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: SalesReturnItemRecord[];
}

export interface CreateReturnLineInput {
  salesItemId: string;
  qty: number;
}

export interface CreateReturnInput {
  originalTransactionId: string;
  lines: CreateReturnLineInput[];
  reasonNotes?: string;
}

export interface QcReturnLineInput {
  returnItemId: string;
  passed: boolean;
  rejectReason?: string;
}

export interface CompleteReturnRefundInput {
  returnId: string;
  refundMethod: "cash" | "transfer";
  sessionId?: string;
}

export interface ApproveLateReturnInput {
  returnId: string;
}

// =============================================================================
// Customer Portal — order online mandiri (demo/localStorage).
// =============================================================================

export type CustomerAccountStatus =
  | "new"
  | "pending_approval"
  | "active_transfer"
  | "member_tempo"
  | "blocked";

export type PortalPaymentMethod = "transfer" | "gopay" | "tempo";

export type PortalPaymentStatus = "unpaid" | "proof_uploaded" | "confirmed" | "paid";

export type OnlineOrderStatus =
  | "pending_approval"
  | "approved"
  | "payment_uploaded"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled"
  | "rejected";

export type PortalStockLabel = "available" | "limited" | "out";

export interface PortalTransferConfig {
  enabled: boolean;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface PortalGopayConfig {
  enabled: boolean;
  merchantPhone: string;
  merchantName: string;
}

export interface CustomerPortalConfig {
  tenantId: string;
  isActive: boolean;
  slug: string;
  storeDisplayName: string;
  whatsappNumber: string;
  welcomeMessage: string;
  allowGuestBrowse: boolean;
  paymentMethods: {
    transfer: PortalTransferConfig;
    gopay: PortalGopayConfig;
  };
}

export interface CustomerPortalAccount {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  /** Demo only — plain PIN/password */
  password: string;
  status: CustomerAccountStatus;
  creditLimit: number;
  paymentTermDays: number;
  outstandingDebt: number;
  internalCustomerId: string | null;
  createdAt: string;
}

export interface OnlineOrderItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  qty: number;
  sellingPrice: number;
  subtotal: number;
}

export interface OnlineOrder {
  id: string;
  tenantId: string;
  branchId: string;
  branchName: string;
  orderNumber: string;
  customerAccountId: string;
  customerName: string;
  customerPhone: string;
  items: OnlineOrderItem[];
  deliveryAddress: string;
  notes: string;
  subtotal: number;
  grandTotal: number;
  paymentMethod: PortalPaymentMethod;
  paymentStatus: PortalPaymentStatus;
  paymentProofNote: string | null;
  paymentProofUploadedAt: string | null;
  paymentConfirmedAt: string | null;
  status: OnlineOrderStatus;
  salesOrderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortalCartItem {
  productId: string;
  branchProductId: string;
  productName: string;
  sku: string;
  unit: string;
  sellingPrice: number;
  qty: number;
  stockLabel: PortalStockLabel;
}

export interface SubmitOnlineOrderDraft {
  tenantId: string;
  branchId: string;
  branchName: string;
  customerAccountId: string;
  customerName: string;
  customerPhone: string;
  items: OnlineOrderItem[];
  deliveryAddress: string;
  notes: string;
  paymentMethod: PortalPaymentMethod;
}

export interface RegisterPortalAccountDraft {
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  password: string;
}

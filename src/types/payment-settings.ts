// =============================================================================
// Pengaturan pembayaran per cabang — transfer & QRIS di POS.
// =============================================================================

export interface TransferAccountSetting {
  id: string;
  label: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isActive: boolean;
}

export interface QrisSetting {
  id: string;
  label: string;
  /** URL https atau data URL (upload gambar QR). */
  imageUrl: string;
  isActive: boolean;
}

export interface BranchPaymentSettings {
  transferAccounts: TransferAccountSetting[];
  qrisEntries: QrisSetting[];
}

export const EMPTY_BRANCH_PAYMENT_SETTINGS: BranchPaymentSettings = {
  transferAccounts: [],
  qrisEntries: [],
};

export function normalizeBranchPaymentSettings(
  raw: BranchPaymentSettings | null | undefined,
): BranchPaymentSettings {
  if (!raw || typeof raw !== "object") return { ...EMPTY_BRANCH_PAYMENT_SETTINGS };
  return {
    transferAccounts: Array.isArray(raw.transferAccounts) ? raw.transferAccounts : [],
    qrisEntries: Array.isArray(raw.qrisEntries) ? raw.qrisEntries : [],
  };
}

export function newTransferAccount(): TransferAccountSetting {
  return {
    id: crypto.randomUUID(),
    label: "",
    bankName: "",
    accountNumber: "",
    accountHolder: "",
    isActive: true,
  };
}

export function newQrisEntry(): QrisSetting {
  return {
    id: crypto.randomUUID(),
    label: "QRIS Toko",
    imageUrl: "",
    isActive: true,
  };
}

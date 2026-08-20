import { SalesDocsPrintDialog } from "@/components/print/SalesDocsPrintDialog";
import type { ReceiptData } from "@/lib/build-receipt-data";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";

export interface SalesReceiptPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ReceiptData | null;
}

/** @deprecated prefer SalesDocsPrintDialog — kept for existing sales-history callers. */
export function SalesReceiptPrintDialog({
  open,
  onOpenChange,
  receipt,
}: SalesReceiptPrintDialogProps) {
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const branchId = useBranchStore((s) => s.activeBranch?.id);

  return (
    <SalesDocsPrintDialog
      open={open}
      onOpenChange={onOpenChange}
      receipt={receipt}
      tenantId={tenantId}
      branchId={branchId}
      title="Cetak struk & invoice"
    />
  );
}

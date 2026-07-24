import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InventorySubNav } from "@/components/inventory/InventorySubNav";
import { TransferList } from "@/components/inventory/TransferList";
import { TransferFormDialog } from "@/components/inventory/TransferFormDialog";
import { TransferDetailDialog } from "@/components/inventory/TransferDetailDialog";
import { useStockTransfer } from "@/hooks/useStockTransfer";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";
import { toast } from "sonner";
import type { DbTransferStatus } from "@/types/database";

export const Route = createFileRoute("/$tenantSlug/inventory/stock-transfer")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "warehouse"]);
  },
  head: () => ({ meta: [{ title: "Transfer Stok — SEPS" }] }),
  component: StockTransferPage,
});

function StockTransferPage() {
  const {
    user,
    branchList,
    activeBranch,
    loading,
    transfers,
    statusFilter,
    setStatusFilter,
    formOpen,
    detailTransfer,
    setDetailTransfer,
    fromBranchId,
    toBranchId,
    setToBranchId,
    notes,
    setNotes,
    draftLines,
    actionLoading,
    formError,
    openCreateForm,
    closeForm,
    handleFromBranchChange,
    updateLineQty,
    createTransfer,
    sendTransfer,
    receiveTransfer,
    cancelTransfer,
    canReceiveTransfer,
  } = useStockTransfer();

  if (!user) return null;

  const handleCreate = async () => {
    const result = await createTransfer();
    if (result.success) toast.success("Transfer draft berhasil dibuat");
    return result;
  };

  const handleSend = async () => {
    if (!detailTransfer) return;
    const result = await sendTransfer(detailTransfer.id);
    if (result.success) {
      toast.success("Transfer dikirim — stok cabang asal berkurang");
      setDetailTransfer({ ...detailTransfer, status: "sent" });
    } else {
      toast.error(result.error ?? "Gagal mengirim transfer");
    }
  };

  const handleReceive = async () => {
    if (!detailTransfer) return;
    const result = await receiveTransfer(detailTransfer.id);
    if (result.success) {
      toast.success("Transfer diterima — stok cabang tujuan bertambah");
    } else {
      toast.error(result.error ?? "Gagal menerima transfer");
    }
  };

  const handleCancel = async () => {
    if (!detailTransfer) return;
    const result = await cancelTransfer(detailTransfer.id);
    if (result.success) {
      toast.success("Transfer dibatalkan");
    } else {
      toast.error(result.error ?? "Gagal membatalkan transfer");
    }
  };

  return (
    <AppShell
      title="Transfer Stok Antar Cabang"
      subtitle="Pindahkan stok dari satu cabang ke cabang lain"
      actions={
        <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-1.5" /> Transfer Baru
        </Button>
      }
    >
      <InventorySubNav />

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Filter status:</span>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as DbTransferStatus | "all")}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Dikirim</SelectItem>
              <SelectItem value="received">Diterima</SelectItem>
              <SelectItem value="cancelled">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>
          {activeBranch && (
            <span className="text-xs text-muted-foreground ml-auto">
              Cabang aktif: {activeBranch.name}
            </span>
          )}
        </div>

        <TransferList
          transfers={transfers}
          loading={loading}
          onSelect={setDetailTransfer}
        />
      </Card>

      <TransferFormDialog
        open={formOpen}
        onClose={closeForm}
        branches={branchList}
        fromBranchId={fromBranchId}
        toBranchId={toBranchId}
        onFromBranchChange={handleFromBranchChange}
        onToBranchChange={setToBranchId}
        notes={notes}
        onNotesChange={setNotes}
        draftLines={draftLines}
        onUpdateQty={updateLineQty}
        onSubmit={handleCreate}
        loading={actionLoading}
        error={formError}
      />

      <TransferDetailDialog
        transfer={detailTransfer}
        onClose={() => setDetailTransfer(null)}
        canReceive={detailTransfer ? canReceiveTransfer(detailTransfer) : false}
        loading={actionLoading}
        onSend={() => void handleSend()}
        onReceive={() => void handleReceive()}
        onCancel={() => void handleCancel()}
      />
    </AppShell>
  );
}

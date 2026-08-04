import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { PurchasingSubNav } from "@/components/purchasing/PurchasingSubNav";
import { GoodsReceiptList } from "@/components/purchasing/GoodsReceiptList";
import { GoodsReceiptFormDialog } from "@/components/purchasing/GoodsReceiptFormDialog";
import { useGoodsReceipt } from "@/hooks/useGoodsReceipt";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";
import { toast } from "sonner";

export const Route = createFileRoute("/$tenantSlug/purchasing/goods-receipt")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "warehouse"]);
  },
  head: () => ({ meta: [{ title: "Penerimaan Barang — SEPS" }] }),
  component: GoodsReceiptPage,
});

function GoodsReceiptPage() {
  const {
    user,
    loading,
    receipts,
    pendingPos,
    selectedPo,
    formOpen,
    actionLoading,
    openReceiveForm,
    closeForm,
    submitReceipt,
  } = useGoodsReceipt();

  if (!user) return null;

  return (
    <AppShell
      title="Penerimaan Barang"
      subtitle="Konfirmasi barang dari supplier — reguler update stok, indent update SO"
    >
      <PurchasingSubNav />

      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold">Penerimaan Barang</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            PO menunggu penerimaan dan riwayat GR dalam satu daftar
          </p>
        </div>
        <GoodsReceiptList
          receipts={receipts}
          pendingPos={pendingPos}
          loading={loading}
          onReceive={openReceiveForm}
        />
      </Card>

      <GoodsReceiptFormDialog
        open={formOpen}
        po={selectedPo}
        onClose={closeForm}
        loading={actionLoading}
        onSubmit={async (receivedQties, notes) => {
          const r = await submitReceipt(receivedQties, notes);
          if (r.success) toast.success(`Penerimaan ${r.grNumber ?? ""} tercatat`);
          else toast.error(r.error ?? "Gagal mencatat penerimaan");
          return r;
        }}
      />
    </AppShell>
  );
}

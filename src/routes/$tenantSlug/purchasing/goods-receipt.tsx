import { createFileRoute } from "@tanstack/react-router";
import { PackageCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PurchasingSubNav } from "@/components/purchasing/PurchasingSubNav";
import { GoodsReceiptList } from "@/components/purchasing/GoodsReceiptList";
import { GoodsReceiptFormDialog } from "@/components/purchasing/GoodsReceiptFormDialog";
import { useGoodsReceipt } from "@/hooks/useGoodsReceipt";
import { poTypeLabel } from "@/stores/purchasing.store";
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

      {pendingPos.length > 0 && (
        <Card className="p-4 mb-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-orange-600" />
            PO Menunggu Penerimaan
          </h3>
          <div className="flex flex-wrap gap-2">
            {pendingPos.map((po) => (
              <Button
                key={po.id}
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => openReceiveForm(po)}
              >
                {po.po_number}
                <Badge variant={po.type === "indent" ? "default" : "secondary"} className="text-[10px]">
                  {poTypeLabel(po.type)}
                </Badge>
              </Button>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold">Riwayat Penerimaan</h3>
        </div>
        <GoodsReceiptList receipts={receipts} loading={loading} />
      </Card>

      <GoodsReceiptFormDialog
        open={formOpen}
        po={selectedPo}
        onClose={closeForm}
        loading={actionLoading}
        onSubmit={submitReceipt}
      />
    </AppShell>
  );
}

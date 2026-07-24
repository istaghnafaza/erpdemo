import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { InventorySubNav } from "@/components/inventory/InventorySubNav";
import { OpnameStepper } from "@/components/inventory/OpnameStepper";
import { useStockOpname } from "@/hooks/useStockOpname";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";
import { toast } from "sonner";

export const Route = createFileRoute("/$tenantSlug/inventory/stock-opname")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "warehouse"]);
  },
  head: () => ({ meta: [{ title: "Stock Opname — SEPS" }] }),
  component: StockOpnamePage,
});

function StockOpnamePage() {
  const {
    user,
    branch,
    step,
    setStep,
    categoryScope,
    setCategoryScope,
    categories,
    lineItems,
    summary,
    reference,
    canApprove,
    submitting,
    submitError,
    pendingOpnameApproval,
    startSession,
    updatePhysicalStock,
    goToReview,
    submitForApproval,
    approveAndAdjust,
    resetFlow,
  } = useStockOpname();

  if (!user) return null;

  if (!branch) {
    return (
      <AppShell title="Stock Opname" subtitle="Hitung fisik stok dan sesuaikan sistem">
        <InventorySubNav />
      </AppShell>
    );
  }

  const handleApprove = async () => {
    const result = await approveAndAdjust();
    if (result.success) {
      toast.success("Stock opname berhasil — stok disesuaikan");
    } else {
      toast.error(result.error ?? "Gagal memproses opname");
    }
  };

  const handleRequestApproval = () => {
    submitForApproval();
    toast.success("Permintaan approval dikirim ke manager");
  };

  return (
    <AppShell
      title="Stock Opname"
      subtitle="Rekonsiliasi stok fisik dengan stok sistem"
    >
      <InventorySubNav />

      <OpnameStepper
        step={step}
        categoryScope={categoryScope}
        onCategoryScopeChange={setCategoryScope}
        categories={categories}
        lineItems={lineItems}
        summary={summary}
        reference={reference}
        branchName={branch.name}
        canApprove={canApprove}
        submitting={submitting}
        submitError={submitError}
        pendingApproval={pendingOpnameApproval}
        onStart={startSession}
        onUpdatePhysical={updatePhysicalStock}
        onGoToReview={goToReview}
        onBack={() => setStep(step === 3 ? 2 : 1)}
        onRequestApproval={handleRequestApproval}
        onApprove={() => void handleApprove()}
        onReset={resetFlow}
      />
    </AppShell>
  );
}

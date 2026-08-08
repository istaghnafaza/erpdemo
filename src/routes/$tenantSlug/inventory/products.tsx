import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InventorySubNav } from "@/components/inventory/InventorySubNav";
import { ProductFilters } from "@/components/inventory/ProductFilters";
import { ProductTable } from "@/components/inventory/ProductTable";
import { ProductDetailDrawer } from "@/components/inventory/ProductDetailDrawer";
import { ProductFormModal } from "@/components/inventory/ProductFormModal";
import { ProductImportDialog } from "@/components/inventory/ProductImportDialog";
import { InventoryInputGuideCard } from "@/components/inventory/InventoryInputGuideCard";
import { useInventoryProducts } from "@/hooks/useInventoryProducts";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";
import { toast } from "sonner";

export const Route = createFileRoute("/$tenantSlug/inventory/products")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "warehouse"]);
  },
  head: () => ({ meta: [{ title: "Master Barang — SEPS" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const {
    user,
    tenantId,
    activeBranch,
    productCatalog,
    canSeePurchasePrice,
    canEditProduct,
    isConsolidated,
    branchList,
    loading,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    branchFilter,
    setBranchFilter,
    categoryNames,
    filteredRows,
    productCount,
    selectedProduct,
    branchStockForProduct,
    detailMovements,
    movementsLoading,
    formOpen,
    importOpen,
    editingProductId,
    editingDefaults,
    existingSkus,
    openDetail,
    closeDetail,
    openCreateForm,
    openEditForm,
    closeForm,
    openImportDialog,
    closeImportDialog,
    downloadTemplateExcel,
    downloadTemplateCsv,
    handleDeactivate,
    handleSaveProduct,
    invalidateInventory,
  } = useInventoryProducts();

  const importBranchId = activeBranch?.id ?? branchList[0]?.id ?? "";
  const importBranchName = activeBranch?.name ?? branchList[0]?.name ?? "Cabang";

  if (!user) return null;

  const handleDeactivateClick = async (productId: string) => {
    const result = await handleDeactivate(productId);
    if (result.success) {
      toast.success("Produk dinonaktifkan");
      closeDetail();
    } else {
      toast.error(result.error ?? "Gagal menonaktifkan produk");
    }
  };

  return (
    <AppShell
      title="Master Barang"
      subtitle="Kelola data master produk, stok, dan harga jual per cabang"
      actions={
        canEditProduct ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1.5" />
                  Template Import
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    downloadTemplateExcel();
                    toast.success("Template Excel (.xlsx) diunduh — multi-sheet per kategori");
                  }}
                >
                  Excel (.xlsx) — disarankan
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    downloadTemplateCsv();
                    toast.success("Template CSV diunduh — satu file, kolom Kategori");
                  }}
                >
                  CSV (.csv) — flat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={openImportDialog}
              disabled={!importBranchId}
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Import Excel
            </Button>
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-1.5" /> Tambah Produk
            </Button>
          </>
        ) : undefined
      }
    >
      <InventorySubNav />

      {canEditProduct ? <InventoryInputGuideCard productCount={productCount} /> : null}

      <Card className="overflow-hidden">
        <ProductFilters
          search={search}
          onSearchChange={setSearch}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          categoryNames={categoryNames}
          isConsolidated={isConsolidated}
          branchFilter={branchFilter}
          onBranchFilterChange={setBranchFilter}
          branches={branchList}
        />

        {loading ? (
          <div className="p-4">
            <LoadingSkeleton variant="table-row" count={8} />
          </div>
        ) : (
          <ProductTable
            rows={filteredRows}
            canSeePurchasePrice={canSeePurchasePrice}
            canEditProduct={canEditProduct}
            isConsolidated={isConsolidated}
            onRowClick={openDetail}
            onViewMovements={openDetail}
            onEdit={openEditForm}
            onDeactivate={handleDeactivateClick}
          />
        )}
      </Card>

      <ProductDetailDrawer
        open={!!selectedProduct}
        onClose={closeDetail}
        product={selectedProduct}
        branchStock={branchStockForProduct}
        movements={detailMovements}
        movementsLoading={movementsLoading}
        canSeePurchasePrice={canSeePurchasePrice}
      />

      <ProductFormModal
        open={formOpen}
        onClose={closeForm}
        editing={!!editingProductId}
        defaults={editingDefaults}
        categoryNames={categoryNames}
        existingSkus={existingSkus}
        canEditPurchasePrice={canSeePurchasePrice && ["owner", "manager"].includes(user.role)}
        onSave={handleSaveProduct}
      />

      {canEditProduct && importBranchId ? (
        <ProductImportDialog
          open={importOpen}
          onClose={closeImportDialog}
          tenantId={tenantId}
          branchId={importBranchId}
          branchName={importBranchName}
          catalog={productCatalog}
          existingSkus={existingSkus}
          onImported={invalidateInventory}
        />
      ) : null}
    </AppShell>
  );
}

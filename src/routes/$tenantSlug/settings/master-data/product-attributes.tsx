import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MasterDataSubNav } from "@/components/settings/MasterDataSubNav";
import { SettingsSubNav } from "@/components/settings/SettingsSubNav";
import { CatalogRequestPanel } from "@/components/settings/CatalogRequestPanel";
import { ProductCatalogEditor } from "@/components/settings/ProductCatalogEditor";
import { useProductAttributesPage } from "@/hooks/useProductAttributesPage";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/$tenantSlug/settings/master-data/product-attributes")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireFeature(params.tenantSlug, "settings");
  },
  head: () => ({
    meta: [
      { title: "Attribute Produk — Pengaturan" },
      {
        name: "description",
        content: "Katalog standar produk & atribut — sama untuk semua toko SEPS.",
      },
    ],
  }),
  component: ProductAttributesPage,
});

function ProductAttributesPage() {
  const catalog = useProductAttributesPage();
  const { user, catalogReadOnly, categories, selectedCategory, selectedProductTypeId, categoryProductTypes } = catalog;

  if (!user) return null;

  const selectedPt = categoryProductTypes.find((pt) => pt.id === selectedProductTypeId);

  return (
    <AppShell
      title="Pengaturan"
      subtitle="Master Data — katalog standar produk & atribut (developer)"
    >
      <SettingsSubNav />
      <MasterDataSubNav />

      {catalogReadOnly && (
        <Card className="p-4 mb-4 border-cyan-500/30 bg-cyan-500/5">
          <div className="flex gap-2 text-sm">
            <Info className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Katalog standar SEPS — read only</p>
              <p className="text-xs text-muted-foreground mt-1">
                Penamaan barang & SKU diseragamkan untuk semua toko agar mudah menambah produk.
                Butuh kategori/jenis/atribut baru? Ajukan request di bawah — developer akan update
                master data.
              </p>
            </div>
          </div>
        </Card>
      )}

      <ProductCatalogEditor {...catalog} />

      {catalogReadOnly && (
        <div className="mt-6">
          <CatalogRequestPanel
            categories={categories}
            selectedCategory={selectedCategory}
            selectedProductType={selectedPt?.name}
          />
        </div>
      )}
    </AppShell>
  );
}

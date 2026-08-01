import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CustomerFormDialog } from "@/components/customers/CustomerFormDialog";
import { CustomerSiteFormDialog } from "@/components/customers/CustomerSiteFormDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCustomerDeliverySitesPage } from "@/hooks/useCustomerDeliverySitesPage";
import { tanggal } from "@/lib/format";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";
import { toast } from "sonner";

export const Route = createFileRoute("/$tenantSlug/customers/")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireFeature(params.tenantSlug, "customers");
  },
  head: () => ({
    meta: [
      { title: "Pelanggan & Lokasi Pengiriman — SEPS" },
      {
        name: "description",
        content: "Kelola pelanggan, lokasi pengiriman, dan proyek untuk checkout POS.",
      },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const {
    user,
    canEditSites,
    customerRows,
    selectedCustomerId,
    setSelectedCustomerId,
    selectedCustomer,
    selectedSites,
    siteFormOpen,
    setSiteFormOpen,
    customerFormOpen,
    setCustomerFormOpen,
    editingSite,
    editingCustomer,
    openAddCustomer,
    openEditCustomer,
    openAddSite,
    openEditSite,
    handleSiteFormSubmit,
    handleCustomerFormSubmit,
    removeSite,
    customerTierOptions,
    siteTypeLabels,
    projectSiteStatusLabel,
    getLastUsedSiteId,
  } = useCustomerDeliverySitesPage();

  if (!user) return null;

  const lastUsedId = selectedCustomer ? getLastUsedSiteId(selectedCustomer.id) : null;

  return (
    <AppShell
      title="Pelanggan"
      subtitle="Data pelanggan, lokasi pengiriman & proyek — dipakai saat checkout POS"
      actions={
        canEditSites && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openAddCustomer}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tambah pelanggan
            </Button>
            {selectedCustomer && (
              <Button size="sm" onClick={openAddSite}>
                <Plus className="h-4 w-4 mr-1.5" />
                Tambah lokasi
              </Button>
            )}
          </div>
        )
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Daftar pelanggan</h2>
          </div>
          <div className="space-y-2">
            {customerRows.map(
              ({ customer, segmentLabel, siteCount, activeCount, lastUsedSiteId }) => (
                <div
                  key={customer.id}
                  className={`rounded-lg border p-3 transition-colors cursor-pointer ${
                    selectedCustomerId === customer.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedCustomerId(customer.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedCustomerId(customer.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="font-medium text-sm">{customer.name}</div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {segmentLabel}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {activeCount}/{siteCount} lokasi aktif
                    </span>
                    {lastUsedSiteId && (
                      <span className="text-[10px] text-primary">· ada riwayat POS</span>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </Card>

        <Card className="p-4 min-h-[320px]">
          {!selectedCustomer ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-16">
              <MapPin className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Pilih pelanggan untuk melihat lokasi pengiriman</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{selectedCustomer.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedCustomer.phone ?? "—"} ·{" "}
                    {selectedCustomer.type === "credit" ? "Kredit" : "Retail"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedSites.length} lokasi tersimpan
                    {!canEditSites && " · mode lihat saja"}
                  </p>
                </div>
                {canEditSites && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditCustomer(selectedCustomer)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit pelanggan
                  </Button>
                )}
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Terakhir order</TableHead>
                      <TableHead>Status</TableHead>
                      {canEditSites && <TableHead className="w-[88px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSites.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canEditSites ? 5 : 4} className="text-center py-8 text-muted-foreground">
                          Belum ada lokasi — tambah dari POS atau tombol di atas.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedSites.map((site) => {
                        const statusLabel = projectSiteStatusLabel(site);
                        const isActive = statusLabel === "Aktif";
                        return (
                          <TableRow key={site.id}>
                            <TableCell>
                              <div className="font-medium text-sm">{site.label}</div>
                              <div className="text-[11px] text-muted-foreground line-clamp-2">
                                {site.address}
                              </div>
                              {site.id === lastUsedId && (
                                <Badge variant="outline" className="text-[10px] mt-1">
                                  Terakhir dipakai POS
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{siteTypeLabels[site.siteType]}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {site.siteType === "proyek" ? (
                                site.lastOrderAt ? (
                                  tanggal(site.lastOrderAt)
                                ) : (
                                  <span className="text-muted-foreground">Belum ada order</span>
                                )
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  isActive
                                    ? "bg-success/15 text-success"
                                    : "bg-muted text-muted-foreground"
                                }
                              >
                                {statusLabel}
                              </Badge>
                            </TableCell>
                            {canEditSites && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditSite(site)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => {
                                      const r = removeSite(site.id);
                                      if (r.ok) toast.success("Lokasi dihapus");
                                      else toast.error(r.error);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>
      </div>

      <CustomerFormDialog
        open={customerFormOpen}
        onOpenChange={setCustomerFormOpen}
        editing={editingCustomer}
        customerTierOptions={customerTierOptions}
        onSubmit={(values) => {
          void handleCustomerFormSubmit(values);
        }}
      />

      <CustomerSiteFormDialog
        open={siteFormOpen}
        onOpenChange={setSiteFormOpen}
        editing={editingSite}
        onSubmit={handleSiteFormSubmit}
      />
    </AppShell>
  );
}

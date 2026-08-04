import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Truck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PurchasingSubNav } from "@/components/purchasing/PurchasingSubNav";
import { SupplierFormDialog } from "@/components/suppliers/SupplierFormDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSuppliersPage } from "@/hooks/useSuppliersPage";
import { rupiah } from "@/lib/format";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";
import { toast } from "sonner";

export const Route = createFileRoute("/$tenantSlug/purchasing/suppliers")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "warehouse"]);
  },
  head: () => ({ meta: [{ title: "Supplier — SEPS" }] }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const {
    user,
    canEdit,
    loading,
    suppliers,
    search,
    setSearch,
    productOptions,
    productNameById,
    formOpen,
    editingSupplier,
    actionLoading,
    openCreateForm,
    openEditForm,
    closeForm,
    saveSupplier,
  } = useSuppliersPage();

  if (!user) return null;

  return (
    <AppShell
      title="Supplier"
      subtitle="Master supplier & produk yang disuplai — dipakai saat fulfillment indent SO"
      actions={
        canEdit && (
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tambah supplier
          </Button>
        )
      }
    >
      <PurchasingSubNav />

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <Truck className="h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Cari nama, telepon, kontak..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm h-9"
          />
          <span className="text-xs text-muted-foreground ml-auto">{suppliers.length} supplier</span>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Memuat supplier...</p>
        ) : suppliers.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Belum ada supplier. Tambah supplier dan tautkan produk yang disuplai.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Kontak / WA</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead>Hutang</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{s.name}</div>
                    {s.contact_person && (
                      <div className="text-xs text-muted-foreground">{s.contact_person}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{s.phone ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {s.product_ids.length === 0 ? (
                        <span className="text-xs text-amber-700">Belum ada produk</span>
                      ) : (
                        s.product_ids.slice(0, 3).map((pid) => (
                          <Badge key={pid} variant="secondary" className="text-[10px] font-normal">
                            {productNameById.get(pid) ?? pid.slice(0, 8)}
                          </Badge>
                        ))
                      )}
                      {s.product_ids.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{s.product_ids.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{s.payment_term_days} hari</TableCell>
                  <TableCell className="text-sm">{rupiah(s.outstanding_debt)}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEditForm(s)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SupplierFormDialog
        open={formOpen}
        onOpenChange={(o) => !o && closeForm()}
        editing={editingSupplier}
        productOptions={productOptions}
        loading={actionLoading}
        onSubmit={async (values) => {
          const result = await saveSupplier(values);
          if (result.success) toast.success(editingSupplier ? "Supplier diperbarui" : "Supplier ditambahkan");
          else toast.error(result.error ?? "Gagal menyimpan");
          return result;
        }}
      />
    </AppShell>
  );
}

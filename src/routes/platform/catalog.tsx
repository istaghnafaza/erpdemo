import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Database,
  RefreshCw,
  Rocket,
  Sparkles,
} from "lucide-react";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { ProductCatalogEditor } from "@/components/settings/ProductCatalogEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProductAttributesPage } from "@/hooks/useProductAttributesPage";
import {
  listPlatformCatalogRequests,
  publishPlatformCatalog,
  resolvePlatformCatalogRequest,
} from "@/lib/api/platform-catalog";
import { useCatalogRequestsStore } from "@/stores/catalog-requests.store";
import { isNeonBackend } from "@/lib/api/backend";
import { requirePlatformAdmin } from "@/routes/platform";
import type { CatalogRequest } from "@/types/product-attributes";
import { toast } from "sonner";

export const Route = createFileRoute("/platform/catalog")({
  beforeLoad: () => {
    requirePlatformAdmin();
  },
  head: () => ({
    meta: [{ title: "Master Data Katalog — Platform" }],
  }),
  component: PlatformCatalogPage,
});

function PlatformCatalogPage() {
  const catalog = useProductAttributesPage({ developerMode: true });
  const allRequests = useCatalogRequestsStore((s) => s.requests);
  const localPending = useMemo(
    () =>
      allRequests
        .filter((r) => r.status === "pending")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [allRequests],
  );
  const resolveLocal = useCatalogRequestsStore((s) => s.resolveRequest);

  const [serverPending, setServerPending] = useState<CatalogRequest[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [loadingReq, setLoadingReq] = useState(false);

  const pending = isNeonBackend() ? serverPending : localPending;

  const loadRequests = async () => {
    setLoadingReq(true);
    const r = await listPlatformCatalogRequests("pending");
    setServerPending(r.data ?? []);
    setLoadingReq(false);
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const handlePublish = async () => {
    setPublishing(true);
    const payload = catalog.getPayload();
    const r = await publishPlatformCatalog(payload);
    setPublishing(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    if (r.data) catalog.loadFromPayload(r.data);
    toast.success(`Master data v${payload.version} diterbitkan ke semua toko`);
  };

  const handleApplySeed = () => {
    catalog.applySeedFromDeveloper();
    toast.success("Seed developer dimuat — review lalu klik Terbitkan");
  };

  const handleResolve = async (id: string, status: "approved" | "rejected") => {
    if (isNeonBackend()) {
      const r = await resolvePlatformCatalogRequest(id, status);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      await loadRequests();
    } else {
      resolveLocal(id, status);
    }
    toast.success(status === "approved" ? "Permintaan disetujui" : "Permintaan ditolak");
  };

  return (
    <PlatformShell
      title="Master Data Katalog"
      subtitle="Standar penamaan & SKU untuk semua toko SEPS"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/platform/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleApplySeed}>
            <Database className="h-4 w-4 mr-1" />
            Muat Seed Code
          </Button>
          <Button
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-700"
            disabled={publishing}
            onClick={() => void handlePublish()}
          >
            <Rocket className="h-4 w-4 mr-1" />
            {publishing ? "Menerbitkan..." : "Terbitkan Master Data"}
          </Button>
        </div>
      }
    >
      <Card className="p-4 mb-4 border-cyan-500/30 bg-cyan-500/5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-cyan-600" />
          Mode Developer
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Edit kategori, jenis barang, dan atribut di bawah. Klik{" "}
          <strong>Terbitkan Master Data</strong> agar semua toko mendapat versi yang sama
          (penamaan & SKU konsisten).
        </p>
      </Card>

      <ProductCatalogEditor {...catalog} />

      <Card className="p-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Permintaan dari Toko</h2>
          <Button variant="ghost" size="sm" onClick={() => void loadRequests()} disabled={loadingReq}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
        {pending.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Tidak ada permintaan pending</p>
        )}
        <div className="space-y-2">
          {pending.map((req) => (
            <div key={req.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="secondary">{req.kind.replace("_", " ")}</Badge>
                <span className="text-muted-foreground">{req.tenantName}</span>
                <span className="font-medium">{req.proposedLabel}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {[req.categoryName, req.productTypeName, req.attributeName].filter(Boolean).join(" → ")}
                {req.notes && ` · ${req.notes}`}
              </p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => void handleResolve(req.id, "rejected")}>
                  Tolak
                </Button>
                <Button
                  size="sm"
                  className="bg-cyan-600 hover:bg-cyan-700"
                  onClick={() => void handleResolve(req.id, "approved")}
                >
                  Setujui (manual apply)
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Setelah setujui, tambahkan item ke katalog di atas lalu klik Terbitkan Master Data.
        </p>
      </Card>
    </PlatformShell>
  );
}

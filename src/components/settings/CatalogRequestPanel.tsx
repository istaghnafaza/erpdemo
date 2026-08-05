import { useMemo, useState } from "react";
import { MessageSquarePlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/stores/auth.store";
import { useCatalogRequestsStore } from "@/stores/catalog-requests.store";
import { submitCatalogRequest } from "@/lib/api/platform-catalog";
import { isNeonBackend } from "@/lib/api/backend";
import type { CatalogRequestKind } from "@/types/product-attributes";
import { toast } from "sonner";

interface CatalogRequestPanelProps {
  categories: string[];
  selectedCategory?: string;
  selectedProductType?: string;
  defaultKind?: CatalogRequestKind;
  defaultAttributeName?: string;
  compact?: boolean;
}

const KIND_LABELS: Record<CatalogRequestKind, string> = {
  category: "Kategori baru",
  product_type: "Jenis barang baru",
  global_attribute: "Atribut global baru",
  attribute_value: "Nilai atribut baru",
};

export function CatalogRequestPanel({
  categories,
  selectedCategory,
  selectedProductType,
  defaultKind = "attribute_value",
  defaultAttributeName,
  compact = false,
}: CatalogRequestPanelProps) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentTenant = useAuthStore((s) => s.currentTenant);
  const submitLocal = useCatalogRequestsStore((s) => s.submitRequest);
  const allRequests = useCatalogRequestsStore((s) => s.requests);
  const tenantId = currentUser?.tenantId ?? "";
  const tenantRequests = useMemo(
    () =>
      allRequests
        .filter((r) => r.tenantId === tenantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allRequests, tenantId],
  );

  const [open, setOpen] = useState(!compact);
  const [kind, setKind] = useState<CatalogRequestKind>(defaultKind);
  const [categoryName, setCategoryName] = useState(selectedCategory ?? "");
  const [productTypeName, setProductTypeName] = useState(selectedProductType ?? "");
  const [attributeName, setAttributeName] = useState(defaultAttributeName ?? "");
  const [proposedLabel, setProposedLabel] = useState("");
  const [proposedAbbr, setProposedAbbr] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  const pendingCount = tenantRequests.filter((r) => r.status === "pending").length;

  const handleSubmit = async () => {
    if (!currentUser?.tenantId) {
      toast.error("Sesi toko tidak valid");
      return;
    }
    if (!proposedLabel.trim()) {
      toast.error("Nama / nilai yang diminta wajib diisi");
      return;
    }
    setSending(true);
    const payload = {
      tenantId: currentUser.tenantId,
      tenantName: currentTenant?.name ?? "Toko",
      kind,
      categoryName: categoryName || selectedCategory,
      productTypeName: productTypeName || selectedProductType,
      attributeName: attributeName || undefined,
      proposedLabel: proposedLabel.trim(),
      proposedAbbreviation: proposedAbbr.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (isNeonBackend()) {
      const r = await submitCatalogRequest(payload);
      setSending(false);
      if (r.error) {
        toast.error(r.error);
        return;
      }
    } else {
      const r = submitLocal(payload);
      setSending(false);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
    }

    toast.success("Permintaan dikirim ke developer");
    setProposedLabel("");
    setProposedAbbr("");
    setNotes("");
    if (compact) setOpen(false);
  };

  return (
    <Card className="p-4 border-dashed border-cyan-500/40 bg-cyan-500/5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <MessageSquarePlus className="h-4 w-4 text-cyan-600" />
            Request ke Developer
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Master data standar untuk semua toko — ajukan kategori, jenis barang, atau nilai
            atribut baru.
            {pendingCount > 0 && (
              <span className="ml-1 text-cyan-700 dark:text-cyan-400">
                ({pendingCount} menunggu)
              </span>
            )}
          </p>
        </div>
        {compact && (
          <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
            {open ? "Tutup" : "Ajukan"}
          </Button>
        )}
      </div>

      {open && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Jenis permintaan</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as CatalogRequestKind)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABELS) as CatalogRequestKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(kind === "product_type" || kind === "attribute_value") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Kategori</Label>
              <Select value={categoryName || undefined} onValueChange={setCategoryName}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === "attribute_value" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Jenis barang</Label>
                <Input
                  className="h-9"
                  value={productTypeName}
                  onChange={(e) => setProductTypeName(e.target.value)}
                  placeholder="Contoh: Hollow Galvanis"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Atribut</Label>
                <Input
                  className="h-9"
                  value={attributeName}
                  onChange={(e) => setAttributeName(e.target.value)}
                  placeholder="Contoh: Merk"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">
              {kind === "attribute_value" ? "Nilai yang diminta *" : "Nama yang diminta *"}
            </Label>
            <Input
              className="h-9"
              value={proposedLabel}
              onChange={(e) => setProposedLabel(e.target.value)}
              placeholder="Contoh: Merk XYZ / Hollow Galvanis 5x5"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Singkatan SKU (opsional)</Label>
            <Input
              className="h-9 font-mono"
              value={proposedAbbr}
              onChange={(e) => setProposedAbbr(e.target.value)}
              placeholder="XYZ"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Catatan untuk developer</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: merk lokal sering dicari pelanggan di area kami"
            />
          </div>

          <div className="sm:col-span-2">
            <Button
              className="bg-cyan-600 hover:bg-cyan-700"
              disabled={sending}
              onClick={() => void handleSubmit()}
            >
              <Send className="h-4 w-4 mr-1" />
              {sending ? "Mengirim..." : "Kirim Permintaan"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

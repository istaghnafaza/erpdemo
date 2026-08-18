import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rupiah, tanggal } from "@/lib/format";
import type { PlatformProductSupplierPayload } from "@/types/platform";
import { Phone, Mail, MapPin, User } from "lucide-react";

export function PlatformProductSupplierDialog({
  open,
  onOpenChange,
  loading,
  sellingPrice,
  branchName,
  payload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  sellingPrice: number;
  branchName: string;
  payload: PlatformProductSupplierPayload | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {payload ? payload.productName : loading ? "Memuat supplier…" : "Supplier"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Mengambil data supplier toko…</p>
        ) : !payload ? (
          <p className="text-sm text-muted-foreground">Data supplier tidak tersedia.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="font-medium">{payload.tenantName}</div>
              <div className="text-xs text-muted-foreground font-mono">SKU {payload.sku || "—"}</div>
              <div className="text-xs text-muted-foreground">Cabang: {branchName}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1">
                <span>
                  Harga jual: <strong>{rupiah(sellingPrice)}</strong>
                </span>
                <span>
                  HPP toko: <strong>{rupiah(payload.purchasePrice)}</strong>
                </span>
              </div>
            </div>

            {payload.suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Toko ini belum menautkan supplier ke barang ini, dan belum ada PO pembelian.
              </p>
            ) : (
              <div className="space-y-3">
                {payload.suppliers.map((s) => (
                  <div key={s.id} className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{s.name}</div>
                      {s.isPreferred ? <Badge>Utama</Badge> : null}
                      {!s.isActive ? <Badge variant="secondary">Nonaktif</Badge> : null}
                    </div>
                    {s.contactPerson ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        {s.contactPerson}
                      </div>
                    ) : null}
                    {s.phone ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <a className="hover:underline" href={`tel:${s.phone}`}>
                          {s.phone}
                        </a>
                      </div>
                    ) : null}
                    {s.email ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <a className="hover:underline" href={`mailto:${s.email}`}>
                          {s.email}
                        </a>
                      </div>
                    ) : null}
                    {s.address ? (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        {s.address}
                      </div>
                    ) : null}
                    <div className="text-xs text-muted-foreground pt-1">
                      Tempo {s.paymentTermDays} hari
                      {s.lastPurchasePrice != null ? (
                        <>
                          {" "}
                          · Beli terakhir {rupiah(s.lastPurchasePrice)}
                          {s.lastPoNumber || s.lastPoAt
                            ? ` (${[s.lastPoNumber, s.lastPoAt ? tanggal(s.lastPoAt) : null]
                                .filter(Boolean)
                                .join(", ")})`
                            : ""}
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { DeliveryStatusBadge } from "@/components/deliveries/DeliveryStatusBadge";
import { DELIVERY_STATUS_FLOW, deliveryStatusLabel } from "@/lib/delivery-utils";
import { orderFulfillmentLabel, paymentMethodLabel } from "@/lib/sales-transaction-utils";
import { tanggal } from "@/lib/format";
import { HandoverPrintDialog } from "@/components/print/HandoverPrintDialog";
import { buildHandoverDocFromDelivery } from "@/lib/handover-doc";
import { ClipboardList } from "lucide-react";
import type { DeliveryRecord, DeliveryStatus, UpdateDeliveryDraft } from "@/types/deliveries";

interface DeliveryDetailDialogProps {
  delivery: DeliveryRecord | null;
  canEdit: boolean;
  onClose: () => void;
  onSave: (
    id: string,
    patch: UpdateDeliveryDraft,
  ) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
}

export function DeliveryDetailDialog({
  delivery,
  canEdit,
  onClose,
  onSave,
}: DeliveryDetailDialogProps) {
  const [status, setStatus] = useState<DeliveryStatus>("pending");
  const [scheduledDate, setScheduledDate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [notes, setNotes] = useState("");
  const [qtyByLine, setQtyByLine] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    if (!delivery) return;
    setStatus(delivery.status);
    setScheduledDate(delivery.scheduledDate?.slice(0, 10) ?? "");
    setDriverName(delivery.driverName ?? "");
    setVehiclePlate(delivery.vehiclePlate ?? "");
    setNotes(delivery.notes ?? "");
    setQtyByLine(
      Object.fromEntries(delivery.items.map((item) => [item.id, item.qtyDelivered])),
    );
    setError(null);
  }, [delivery]);

  if (!delivery) return null;

  const handoverDoc = {
    ...buildHandoverDocFromDelivery(delivery),
    driverName: driverName.trim() || delivery.driverName,
    vehiclePlate: vehiclePlate.trim() || delivery.vehiclePlate,
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await Promise.resolve(
      onSave(delivery.id, {
        status,
        scheduledDate: scheduledDate || null,
        driverName: driverName.trim() || null,
        vehiclePlate: vehiclePlate.trim() || null,
        notes: notes.trim() || null,
        items: delivery.items.map((item) => ({
          id: item.id,
          qtyDelivered: qtyByLine[item.id] ?? item.qtyDelivered,
        })),
      }),
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Gagal menyimpan");
      return;
    }
    onClose();
  };

  return (
    <>
    <Dialog open={!!delivery} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-mono text-base">
            {delivery.deliveryNumber}
            <DeliveryStatusBadge status={delivery.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <div className="text-muted-foreground text-xs">Transaksi POS</div>
            <div className="font-mono text-xs">{delivery.transactionNumber}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Tanggal order</div>
            <div>{tanggal(delivery.createdAt, { withTime: true })}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Cabang</div>
            <div>{delivery.branchName}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Kasir</div>
            <div>{delivery.cashierName}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Pelanggan</div>
            <div>{delivery.customerName ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Telepon</div>
            <div>{delivery.customerPhone ?? "—"}</div>
          </div>
          <div className="col-span-2">
            <div className="text-muted-foreground text-xs">Alamat pengiriman</div>
            {delivery.deliverySiteLabel && (
              <div className="text-xs font-medium text-primary mb-0.5">
                {delivery.deliverySiteLabel}
              </div>
            )}
            <div>{delivery.deliveryAddress}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Keterangan order</div>
            <div>{orderFulfillmentLabel(delivery.orderFulfillmentType)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Metode bayar</div>
            <div>{paymentMethodLabel(delivery.paymentMethod)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Total order</div>
            <div>
              <CurrencyDisplay value={delivery.grandTotal} />
            </div>
          </div>
          {delivery.deliveredAt && (
            <div>
              <div className="text-muted-foreground text-xs">Terkirim pada</div>
              <div>{tanggal(delivery.deliveredAt, { withTime: true })}</div>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="rounded-lg border p-4 space-y-4 mb-4 bg-muted/20">
            <div className="text-sm font-medium">Update operasional</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="delivery-status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as DeliveryStatus)}>
                  <SelectTrigger id="delivery-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_STATUS_FLOW.map((s) => (
                      <SelectItem key={s} value={s}>
                        {deliveryStatusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scheduled-date">Jadwal kirim</Label>
                <Input
                  id="scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="driver-name">Nama driver</Label>
                <Input
                  id="driver-name"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Contoh: Pak Budi"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehicle-plate">Plat kendaraan</Label>
                <Input
                  id="vehicle-plate"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="B 1234 XYZ"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="delivery-notes">Catatan</Label>
                <Textarea
                  id="delivery-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Instruksi pengiriman, kendala, dll."
                />
              </div>
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produk</TableHead>
              <TableHead className="text-right">Order</TableHead>
              <TableHead className="text-right">Qty kirim</TableHead>
              <TableHead className="text-right">Terkirim</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {delivery.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium text-sm">{item.productName}</div>
                  <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                </TableCell>
                <TableCell className="text-right">
                  {item.qtyOrdered} {item.unit}
                </TableCell>
                <TableCell className="text-right">
                  {item.qtyToDeliver} {item.unit}
                </TableCell>
                <TableCell className="text-right">
                  {canEdit ? (
                    <Input
                      type="number"
                      min={0}
                      max={item.qtyToDeliver}
                      className="w-20 ml-auto h-8 text-right"
                      value={qtyByLine[item.id] ?? 0}
                      onChange={(e) =>
                        setQtyByLine((prev) => ({
                          ...prev,
                          [item.id]: Number(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    <>
                      {item.qtyDelivered} {item.unit}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {!canEdit && (
          <p className="text-xs text-muted-foreground mt-3">
            Pengiriman dibuat otomatis dari checkout POS. Hubungi gudang atau manager untuk
            update status.
          </p>
        )}

        {error && <p className="text-sm text-destructive mt-3">{error}</p>}

        <DialogFooter className="gap-2 sm:justify-between flex-wrap">
          <Button variant="outline" onClick={() => setPrintOpen(true)}>
            <ClipboardList className="h-4 w-4 mr-1.5" /> Cetak Surat Jalan
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Tutup
            </Button>
            {canEdit && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan perubahan"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <HandoverPrintDialog open={printOpen} onOpenChange={setPrintOpen} doc={handoverDoc} />
    </>
  );
}

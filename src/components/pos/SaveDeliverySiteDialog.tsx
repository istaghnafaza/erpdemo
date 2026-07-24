import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DELIVERY_SITE_TYPE_LABELS } from "@/lib/customer-delivery-utils";
import type { DeliverySiteType } from "@/types/customer-delivery-sites";

export interface SaveDeliverySiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAddress: string;
  onSave: (payload: {
    label: string;
    address: string;
    siteType: DeliverySiteType;
  }) => void;
}

export function SaveDeliverySiteDialog({
  open,
  onOpenChange,
  initialAddress,
  onSave,
}: SaveDeliverySiteDialogProps) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState(initialAddress);
  const [siteType, setSiteType] = useState<DeliverySiteType>("lainnya");
  const [error, setError] = useState<string | null>(null);

  const handleOpen = (next: boolean) => {
    if (next) {
      setLabel("");
      setAddress(initialAddress);
      setSiteType("lainnya");
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSave = () => {
    if (!label.trim()) {
      setError("Nama lokasi wajib diisi");
      return;
    }
    if (!address.trim()) {
      setError("Alamat wajib diisi");
      return;
    }
    onSave({ label: label.trim(), address: address.trim(), siteType });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Simpan sebagai lokasi baru</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="site-label">Nama lokasi / proyek</Label>
            <Input
              id="site-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Contoh: Proyek Apartemen B"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-address">Alamat lengkap</Label>
            <Input
              id="site-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-type">Tipe lokasi</Label>
            <Select value={siteType} onValueChange={(v) => setSiteType(v as DeliverySiteType)}>
              <SelectTrigger id="site-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DELIVERY_SITE_TYPE_LABELS) as DeliverySiteType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {DELIVERY_SITE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSave}>Simpan lokasi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const MANUAL_DELIVERY_SITE_VALUE = "__manual__";

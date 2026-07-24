import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DELIVERY_SITE_TYPE_LABELS } from "@/lib/customer-delivery-utils";
import type {
  CustomerDeliverySite,
  DeliverySiteType,
} from "@/types/customer-delivery-sites";

export interface CustomerSiteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CustomerDeliverySite | null;
  onSubmit: (values: {
    label: string;
    address: string;
    siteType: DeliverySiteType;
    contactName: string | null;
    contactPhone: string | null;
    isDefault: boolean;
    isActive: boolean;
  }) => void;
}

export function CustomerSiteFormDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: CustomerSiteFormDialogProps) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [siteType, setSiteType] = useState<DeliverySiteType>("proyek");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(editing?.label ?? "");
    setAddress(editing?.address ?? "");
    setSiteType(editing?.siteType ?? "proyek");
    setContactName(editing?.contactName ?? "");
    setContactPhone(editing?.contactPhone ?? "");
    setIsDefault(editing?.isDefault ?? false);
    setIsActive(editing?.isActive ?? true);
    setError(null);
  }, [open, editing]);

  const title = useMemo(() => (editing ? "Edit lokasi" : "Tambah lokasi"), [editing]);

  const handleSubmit = () => {
    if (!label.trim()) {
      setError("Nama lokasi wajib diisi");
      return;
    }
    if (!address.trim()) {
      setError("Alamat wajib diisi");
      return;
    }
    onSubmit({
      label: label.trim(),
      address: address.trim(),
      siteType,
      contactName: contactName.trim() || null,
      contactPhone: contactPhone.trim() || null,
      isDefault,
      isActive,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="cs-label">Nama lokasi / proyek</Label>
            <Input id="cs-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-address">Alamat</Label>
            <Input id="cs-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-type">Tipe</Label>
            <Select value={siteType} onValueChange={(v) => setSiteType(v as DeliverySiteType)}>
              <SelectTrigger id="cs-type">
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
            {siteType === "proyek" && (
              <p className="text-[11px] text-muted-foreground">
                Proyek otomatis nonaktif jika 30 hari tanpa transaksi order.
              </p>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cs-contact">PIC</Label>
              <Input
                id="cs-contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-phone">Telepon PIC</Label>
              <Input
                id="cs-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isDefault} onCheckedChange={(c) => setIsDefault(c === true)} />
              Default
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} />
              Aktif
            </label>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

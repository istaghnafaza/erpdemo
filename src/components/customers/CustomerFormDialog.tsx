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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CUSTOMER_SEGMENT_LABELS } from "@/lib/customer-delivery-utils";
import type { TenantCustomerRecord } from "@/stores/customers.store";
import type { CustomerSegment } from "@/types/customer-delivery-sites";
import type { DbCustomerType } from "@/types/database";

export interface CustomerFormValues {
  name: string;
  phone: string | null;
  address: string | null;
  type: DbCustomerType;
  credit_limit: number;
  segment: CustomerSegment;
}

export interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: TenantCustomerRecord | null;
  onSubmit: (values: CustomerFormValues) => void;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: CustomerFormDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState<DbCustomerType>("retail");
  const [creditLimit, setCreditLimit] = useState("");
  const [segment, setSegment] = useState<CustomerSegment>("umum");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setPhone(editing?.phone ?? "");
    setAddress(editing?.address ?? "");
    setType(editing?.type ?? "retail");
    setCreditLimit(editing?.credit_limit ? String(editing.credit_limit) : "");
    setSegment(editing?.segment ?? "umum");
    setError(null);
  }, [open, editing]);

  const title = useMemo(() => (editing ? "Edit pelanggan" : "Tambah pelanggan"), [editing]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Nama wajib diisi");
      return;
    }
    const limit = type === "credit" ? Number(creditLimit.replace(/\D/g, "")) : 0;
    if (type === "credit" && limit <= 0) {
      setError("Limit kredit wajib diisi");
      return;
    }
    onSubmit({
      name: name.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      type,
      credit_limit: limit,
      segment,
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
            <Label htmlFor="cust-name">Nama</Label>
            <Input id="cust-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cust-phone">Telepon</Label>
              <Input id="cust-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-segment">Segment</Label>
              <Select value={segment} onValueChange={(v) => setSegment(v as CustomerSegment)}>
                <SelectTrigger id="cust-segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CUSTOMER_SEGMENT_LABELS) as CustomerSegment[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {CUSTOMER_SEGMENT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-address">Alamat</Label>
            <Input id="cust-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cust-type">Tipe</Label>
              <Select value={type} onValueChange={(v) => setType(v as DbCustomerType)}>
                <SelectTrigger id="cust-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail / tunai</SelectItem>
                  <SelectItem value="credit">Kredit / piutang</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === "credit" && (
              <div className="space-y-1.5">
                <Label htmlFor="cust-limit">Limit kredit (Rp)</Label>
                <Input
                  id="cust-limit"
                  inputMode="numeric"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                />
              </div>
            )}
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

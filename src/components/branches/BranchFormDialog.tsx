import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { BranchWithManager } from "@/lib/api/branches";
import type { TenantUserRecord } from "@/types/app";

export interface BranchFormValues {
  name: string;
  code: string;
  address: string;
  phone: string;
  managerId: string | null;
}

interface BranchFormDialogProps {
  open: boolean;
  branch: BranchWithManager | null;
  managerCandidates: TenantUserRecord[];
  onClose: () => void;
  onSubmit: (
    values: BranchFormValues,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
}

const EMPTY: BranchFormValues = {
  name: "",
  code: "",
  address: "",
  phone: "",
  managerId: null,
};

export function BranchFormDialog({
  open,
  branch,
  managerCandidates,
  onClose,
  onSubmit,
}: BranchFormDialogProps) {
  const [form, setForm] = useState<BranchFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !branch) return;
    setForm({
      name: branch.name,
      code: branch.code,
      address: branch.address ?? "",
      phone: branch.phone ?? "",
      managerId: branch.manager_id,
    });
  }, [open, branch]);

  const handleSubmit = async () => {
    if (!form.name.trim()) return { ok: false, error: "Nama toko wajib diisi" };
    if (!form.code.trim()) return { ok: false, error: "Kode toko wajib diisi" };

    setSaving(true);
    const result = await onSubmit({
      ...form,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      managerId: form.managerId,
    });
    setSaving(false);
    if (result.ok) onClose();
    return result;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Toko</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="branch-name">Nama Toko</Label>
            <Input
              id="branch-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-code">Kode</Label>
            <Input
              id="branch-code"
              value={form.code}
              maxLength={12}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-manager">Manager Cabang</Label>
            <Select
              value={form.managerId ?? "none"}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, managerId: v === "none" ? null : v }))
              }
            >
              <SelectTrigger id="branch-manager">
                <SelectValue placeholder="Pilih manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Tidak ada —</SelectItem>
                {managerCandidates.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-address">Alamat</Label>
            <Textarea
              id="branch-address"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-phone">Telepon</Label>
            <Input
              id="branch-phone"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button
            className="bg-gradient-primary"
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function toUpdateBranchPayload(values: BranchFormValues) {
  return {
    code: values.code,
    name: values.name,
    address: values.address || null,
    phone: values.phone || null,
    manager_id: values.managerId,
  };
}

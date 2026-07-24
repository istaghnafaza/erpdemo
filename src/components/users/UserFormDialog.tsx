import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  ASSIGNABLE_USER_ROLES,
  roleLabel,
  type CreateTenantUserInput,
  type TenantUserRecord,
  type UpdateTenantUserInput,
  type UserRole,
} from "@/types/app";
import type { Branch } from "@/types/database";

export interface UserFormValues {
  name: string;
  email: string;
  role: UserRole;
  pin: string;
  branchIds: string[];
}

interface UserFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  user: TenantUserRecord | null;
  branches: Branch[];
  onClose: () => void;
  onSubmit: (
    values: UserFormValues,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
}

const EMPTY: UserFormValues = {
  name: "",
  email: "",
  role: "cashier",
  pin: "",
  branchIds: [],
};

export function UserFormDialog({
  open,
  mode,
  user,
  branches,
  onClose,
  onSubmit,
}: UserFormDialogProps) {
  const [form, setForm] = useState<UserFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && user) {
      setForm({
        name: user.name,
        email: user.email,
        role: user.role,
        pin: user.pin,
        branchIds: user.branchIds,
      });
    } else {
      setForm({
        ...EMPTY,
        branchIds: branches[0] ? [branches[0].id] : [],
      });
    }
  }, [open, mode, user, branches]);

  const toggleBranch = (branchId: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      branchIds: checked
        ? [...new Set([...f.branchIds, branchId])]
        : f.branchIds.filter((id) => id !== branchId),
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    const result = await onSubmit(form);
    setSaving(false);
    if (result.ok) onClose();
  };

  const roleOptions =
    mode === "edit" && user?.role === "owner"
      ? (["owner"] as UserRole[])
      : ASSIGNABLE_USER_ROLES;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Pegawai" : "Edit Pegawai"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Nama lengkap</Label>
            <Input
              id="user-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Andi Pratama"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-email">Email login</Label>
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="andi@toko.id"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as UserRole })}
                disabled={user?.role === "owner"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-pin">PIN (6 digit)</Label>
              <Input
                id="user-pin"
                inputMode="numeric"
                maxLength={6}
                value={form.pin}
                onChange={(e) =>
                  setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })
                }
                placeholder="123456"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cabang yang boleh diakses</Label>
            <div className="rounded-lg border p-3 space-y-2 max-h-40 overflow-y-auto">
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.branchIds.includes(b.id)}
                    onCheckedChange={(c) => toggleBranch(b.id, c === true)}
                  />
                  <span>{b.name}</span>
                </label>
              ))}
              {branches.length === 0 && (
                <p className="text-xs text-muted-foreground">Belum ada cabang dimuat.</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Pegawai login dengan <strong>email + PIN</strong> di halaman masuk (mode demo).
            Hak akses menu mengikuti role yang dipilih.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button className="bg-gradient-primary" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? "Menyimpan..." : mode === "create" ? "Tambah Pegawai" : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function toCreateInput(values: UserFormValues): CreateTenantUserInput {
  return {
    name: values.name,
    email: values.email,
    role: values.role,
    pin: values.pin,
    branchIds: values.branchIds,
  };
}

export function toUpdateInput(values: UserFormValues): UpdateTenantUserInput {
  return {
    name: values.name,
    email: values.email,
    role: values.role,
    pin: values.pin,
    branchIds: values.branchIds,
  };
}

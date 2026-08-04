import { useEffect, useState } from "react";
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
import { useAccountProfile, type AccountProfileFormValues } from "@/hooks/useAccountProfile";

interface AccountProfileDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const EMPTY: AccountProfileFormValues = {
  name: "",
  email: "",
  phone: "",
  address: "",
  dateOfBirth: "",
  pin: "",
};

export function AccountProfileDialog({ open, onClose, onSaved }: AccountProfileDialogProps) {
  const { roleLabel, saving, loadFormValues, saveProfile } = useAccountProfile();
  const [form, setForm] = useState<AccountProfileFormValues>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(loadFormValues());
    setError(null);
  }, [open, loadFormValues]);

  const handleSubmit = async () => {
    setError(null);
    const result = await saveProfile(form);
    if (!result.ok) {
      setError(result.error ?? "Gagal menyimpan");
      return;
    }
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Profil Akun</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Perbarui data pribadi Anda · {roleLabel}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Nama lengkap</Label>
            <Input
              id="profile-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nama pemilik / pegawai"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email login</Label>
            <Input id="profile-email" type="email" value={form.email} disabled />
            <p className="text-[11px] text-muted-foreground">
              Email login tidak dapat diubah dari sini.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone">No. telepon</Label>
              <Input
                id="profile-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="08123456789"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-dob">Tanggal lahir</Label>
              <Input
                id="profile-dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-address">Alamat</Label>
            <Input
              id="profile-address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Alamat domisili"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-pin">PIN login (6 digit)</Label>
            <Input
              id="profile-pin"
              inputMode="numeric"
              maxLength={6}
              value={form.pin}
              onChange={(e) =>
                setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })
              }
              placeholder="Kosongkan jika tidak diubah"
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button className="bg-gradient-primary" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? "Menyimpan..." : "Simpan Profil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

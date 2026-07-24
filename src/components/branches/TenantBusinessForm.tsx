import { useEffect, useState } from "react";
import { Building2, ImageIcon, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTenant } from "@/lib/api/tenants";
import { useAuthStore } from "@/stores/auth.store";
import type { Tenant } from "@/types/database";
import { toast } from "sonner";

interface TenantBusinessFormProps {
  tenant: Tenant | null;
  onUpdated: (tenant: Tenant) => void;
}

export function TenantBusinessForm({ tenant, onUpdated }: TenantBusinessFormProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name);
    setPhone(tenant.phone ?? "");
    setLogoUrl(tenant.logo_url ?? "");
  }, [tenant]);

  if (!tenant) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nama bisnis wajib diisi");
      return;
    }
    setSaving(true);
    const result = await updateTenant(tenant.id, {
      name: name.trim(),
      phone: phone.trim() || null,
      logo_url: logoUrl.trim() || null,
    });
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? "Gagal menyimpan info bisnis");
      return;
    }
    useAuthStore.setState({ currentTenant: result.data });
    onUpdated(result.data);
    setEditing(false);
    toast.success("Info bisnis diperbarui");
  };

  return (
    <Card className="p-5 shadow-card mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="h-14 w-14 rounded-xl bg-orange-500/15 text-orange-600 grid place-items-center shrink-0 overflow-hidden">
            {logoUrl.trim() ? (
              <img
                src={logoUrl.trim()}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Building2 className="h-7 w-7" />
            )}
          </div>
          {!editing ? (
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Info Bisnis
              </div>
              <div className="text-xl font-bold mt-0.5 truncate">{tenant.name}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {tenant.phone || "Telepon belum diisi"}
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Toko/cabang baru hanya dapat ditambahkan melalui{" "}
                <strong>Setup</strong> (<code className="text-[10px]">/onboarding</code>).
              </p>
            </div>
          ) : (
            <div className="grid gap-3 flex-1 max-w-lg">
              <div className="grid gap-2">
                <Label htmlFor="tenant-name">Nama Bisnis</Label>
                <Input
                  id="tenant-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tenant-phone">Telepon</Label>
                <Input
                  id="tenant-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xx-xxxx-xxxx"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tenant-logo" className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  URL Logo
                </Label>
                <Input
                  id="tenant-logo"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                />
                <p className="text-[11px] text-muted-foreground">
                  Paste URL gambar logo (PNG/JPG). Upload file akan ditambahkan nanti.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="shrink-0">
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                Batal
              </Button>
              <Button size="sm" className="bg-gradient-primary" onClick={() => void handleSave()} disabled={saving}>
                <Save className="h-4 w-4 mr-1.5" />
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

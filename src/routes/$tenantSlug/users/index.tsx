import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Shield, UserCog, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { UserFormDialog, toCreateInput, toUpdateInput, type UserFormValues } from "@/components/users/UserFormDialog";
import { UserRoleBadge } from "@/components/users/UserRoleBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUsersPage } from "@/hooks/useUsersPage";
import { createTenantUser, setTenantUserActive, updateTenantUser } from "@/lib/api/users";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";
import type { TenantUserRecord } from "@/types/app";
import { initials } from "@/types/app";
import { toast } from "sonner";

export const Route = createFileRoute("/$tenantSlug/users/")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireFeature(params.tenantSlug, "users");
  },
  head: () => ({
    meta: [
      { title: "Pegawai — SEPS" },
      { name: "description", content: "Kelola pegawai, role, cabang, dan akses login." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const {
    tenantId,
    currentUserId,
    users,
    loading,
    branches,
    branchNameById,
    reload,
  } = useUsersPage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TenantUserRecord | null>(null);

  const activeCount = users.filter((u) => u.isActive).length;

  const openCreate = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };

  const openEdit = (user: TenantUserRecord) => {
    setEditTarget(user);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: UserFormValues) => {
    if (editTarget) {
      const result = await updateTenantUser(tenantId, editTarget.id, toUpdateInput(values));
      if (result.error) {
        toast.error(result.error ?? "Gagal memperbarui pegawai");
        return { ok: false, error: result.error ?? undefined };
      }
      toast.success("Pegawai diperbarui");
    } else {
      const result = await createTenantUser(tenantId, toCreateInput(values));
      if (result.error) {
        toast.error(result.error);
        return { ok: false, error: result.error };
      }
      toast.success("Pegawai ditambahkan");
    }
    await reload();
    return { ok: true };
  };

  const toggleActive = async (user: TenantUserRecord) => {
    const result = await setTenantUserActive(tenantId, user.id, !user.isActive);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(user.isActive ? "Pegawai dinonaktifkan" : "Pegawai diaktifkan kembali");
    await reload();
  };

  return (
    <AppShell
      title="Pegawai"
      subtitle="Kelola akun login, role, dan cabang yang boleh diakses setiap pegawai."
      actions={
        <Button className="bg-gradient-primary" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Pegawai
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Total Pegawai
              </div>
              <div className="text-2xl font-bold mt-1">{users.length}</div>
            </div>
            <div className="h-9 w-9 rounded-xl bg-violet-500/15 text-violet-600 grid place-items-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Aktif
              </div>
              <div className="text-2xl font-bold mt-1">{activeCount}</div>
            </div>
            <div className="h-9 w-9 rounded-xl bg-green-500/15 text-green-600 grid place-items-center">
              <Shield className="h-4 w-4" />
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Role Berbeda
              </div>
              <div className="text-2xl font-bold mt-1">
                {new Set(users.map((u) => u.role)).size}
              </div>
            </div>
            <div className="h-9 w-9 rounded-xl bg-blue-500/15 text-blue-600 grid place-items-center">
              <UserCog className="h-4 w-4" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pegawai</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Cabang</TableHead>
              <TableHead>PIN</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Memuat pegawai...
                </TableCell>
              </TableRow>
            )}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Belum ada pegawai. Tambahkan pegawai pertama untuk mulai.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              users.map((user) => (
                <TableRow key={user.id} className={!user.isActive ? "opacity-60" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center text-xs font-semibold shrink-0">
                        {initials(user.name)}
                      </div>
                      <div>
                        <div className="font-medium leading-none">
                          {user.name}
                          {user.id === currentUserId && (
                            <span className="text-[10px] text-muted-foreground ml-2">(Anda)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <UserRoleBadge role={user.role} />
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <div className="text-xs leading-relaxed">
                      {user.branchIds.map((id) => branchNameById[id] ?? "—").join(", ") || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{user.pin}</code>
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge className="bg-success/15 text-success hover:bg-success/15">Aktif</Badge>
                    ) : (
                      <Badge variant="secondary">Nonaktif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                        Edit
                      </Button>
                      {!user.isProtected && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void toggleActive(user)}
                        >
                          {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>

      <UserFormDialog
        open={dialogOpen}
        mode={editTarget ? "edit" : "create"}
        user={editTarget}
        branches={branches}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}

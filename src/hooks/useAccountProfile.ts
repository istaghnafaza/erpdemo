import { useCallback, useState } from "react";
import { updateProfile } from "@/lib/api/auth";
import { isMockTenantId } from "@/lib/mock-session";
import { useAuthStore } from "@/stores/auth.store";
import { useUsersStore } from "@/stores/users.store";
import { roleLabel } from "@/types/app";
import type { AccountProfileUpdates, AppProfile } from "@/types/app";

export interface AccountProfileFormValues {
  name: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  pin: string;
}

export function useAccountProfile() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [saving, setSaving] = useState(false);

  const profile = currentUser?.profile ?? null;

  const loadFormValues = useCallback((): AccountProfileFormValues => {
    if (!currentUser) {
      return { name: "", email: "", phone: "", address: "", dateOfBirth: "", pin: "" };
    }

    let phone = profile?.phone ?? "";
    let address = profile?.address ?? "";
    let dateOfBirth = profile?.dateOfBirth ?? "";

    if (isMockTenantId(currentUser.tenantId)) {
      useUsersStore.getState().initForTenant(currentUser.tenantId);
      const record = useUsersStore.getState().findById(currentUser.id);
      if (record) {
        phone = record.phone ?? "";
        address = record.address ?? "";
        dateOfBirth = record.dateOfBirth ?? "";
      }
    }

    return {
      name: profile?.name ?? "",
      email: profile?.email ?? currentUser.email,
      phone,
      address,
      dateOfBirth,
      pin: "",
    };
  }, [currentUser, profile]);

  const saveProfile = useCallback(
    async (values: AccountProfileFormValues): Promise<{ ok: boolean; error?: string }> => {
      if (!currentUser) return { ok: false, error: "Sesi tidak valid" };
      if (!values.name.trim()) return { ok: false, error: "Nama wajib diisi" };
      if (values.pin && !/^\d{6}$/.test(values.pin)) {
        return { ok: false, error: "PIN harus 6 digit angka" };
      }

      const updates: AccountProfileUpdates = {
        name: values.name.trim(),
        phone: values.phone.trim() || null,
        address: values.address.trim() || null,
        dateOfBirth: values.dateOfBirth || null,
      };
      if (values.pin) updates.pin = values.pin;

      setSaving(true);
      const result = await updateProfile(currentUser.id, updates);
      setSaving(false);

      if (result.error || !result.data) {
        return { ok: false, error: result.error ?? "Gagal menyimpan profil" };
      }

      const updated: AppProfile = result.data;
      useAuthStore.setState({
        currentUser: {
          ...currentUser,
          profile: {
            ...updated,
            pin: values.pin ? values.pin : currentUser.profile.pin,
          },
        },
      });
      await refreshUser({ force: true });
      return { ok: true };
    },
    [currentUser, refreshUser],
  );

  return {
    profile,
    roleLabel: profile ? roleLabel(profile.role) : "",
    saving,
    loadFormValues,
    saveProfile,
  };
}

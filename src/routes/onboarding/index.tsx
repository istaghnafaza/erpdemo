import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Package,
  Sparkles,
  Store,
  Upload,
  UserPlus,
} from "lucide-react";
import { useAuthStore, MOCK_TENANT_ID } from "@/stores/auth.store";
import { isNeonBackend } from "@/lib/api/backend";
import { isMockDemoUser } from "@/lib/mock-session";
import { createBranch, assignUserToBranch, finalizeOnboardingPrimaryBranch } from "@/lib/api/branches";
import { setLegacyMode, updateTenant } from "@/lib/api/tenants";
import { createTenantUser } from "@/lib/api/users";
import { useBranchStore } from "@/stores/branch.store";
import { useUsersStore } from "@/stores/users.store";
import { MOCK_BRANCH_ONBOARDING, MOCK_BRANCH_SUDIRMAN } from "@/lib/mock-ids";
import {
  applyOnboardingInventoryToBranch,
  collectOnboardingInventoryItems,
} from "@/lib/apply-onboarding-inventory";
import {
  useOnboardingStore,
  type OnboardingPath,
  type OnboardingUserDraft,
} from "@/stores/onboarding.store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  firstValidationMessage,
  validateOnboardingUser,
  validateProductsStep,
  validateStoreInfo,
  type StoreInfoErrors,
  type StoreInfoField,
} from "@/lib/onboarding-validation";
import { AddBranchSetupPanel } from "@/components/onboarding/AddBranchSetupPanel";
import { redirectIfOnboardingComplete, syncAuthFromServer } from "@/lib/auth-bootstrap";
import { isPendingTenantName } from "@/lib/tenant-placeholder";
import { useTenantSlugAvailability } from "@/hooks/useTenantSlugAvailability";
import type { UserRole } from "@/types/app";

export const Route = createFileRoute("/onboarding/")({
  beforeLoad: async () => {
    await syncAuthFromServer();
    const { addBranchOnly, wizardResumeMode } = useOnboardingStore.getState();
    if (!addBranchOnly && !wizardResumeMode) {
      const doneRedirect = redirectIfOnboardingComplete();
      if (doneRedirect) throw doneRedirect;
    }
  },
  head: () => ({
    meta: [
      { title: "Setup Toko — SEPS" },
      { name: "description", content: "Wizard setup toko baru SEPS." },
    ],
  }),
  component: OnboardingPage,
});

const STEPS = ["Jalur", "Toko", "User", "Produk", "Selesai"] as const;

const PATHS: {
  id: OnboardingPath;
  icon: typeof Store;
  title: string;
  description: string;
  eta: string;
}[] = [
  {
    id: "new",
    icon: Sparkles,
    title: "Toko Baru",
    description: "Mulai dari nol dengan library produk bangunan siap pakai.",
    eta: "~15 menit",
  },
  {
    id: "no-records",
    icon: Package,
    title: "Tidak Ada Catatan",
    description: "Isi produk manual, stok boleh dikosongkan dulu.",
    eta: "~10 menit",
  },
  {
    id: "book",
    icon: BookOpen,
    title: "Catatan Buku",
    description: "Input massal lewat tabel seperti buku catatan.",
    eta: "~20 menit",
  },
  {
    id: "excel",
    icon: FileSpreadsheet,
    title: "Dari Excel",
    description: "Upload spreadsheet dengan validasi per baris.",
    eta: "~8 menit",
  },
];

function OnboardingPage() {
  const addBranchOnly = useOnboardingStore((s) => s.addBranchOnly);
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const tenantSlug = useAuthStore((s) => s.currentTenant?.slug) ?? "toko-simetri";
  const currentTenant = useAuthStore((s) => s.currentTenant);

  const step = useOnboardingStore((s) => s.step);
  const path = useOnboardingStore((s) => s.path);
  const setStep = useOnboardingStore((s) => s.setStep);
  const setPath = useOnboardingStore((s) => s.setPath);
  const updateStoreInfo = useOnboardingStore((s) => s.updateStoreInfo);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const getSummary = useOnboardingStore((s) => s.getSummary);
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const startAddBranchSetup = useOnboardingStore((s) => s.startAddBranchSetup);

  const storeName = useOnboardingStore((s) => s.storeName);
  const storeSlug = useOnboardingStore((s) => s.storeSlug);
  const storeAddress = useOnboardingStore((s) => s.storeAddress);
  const storePhone = useOnboardingStore((s) => s.storePhone);
  const storeNpwp = useOnboardingStore((s) => s.storeNpwp);
  const branchName = useOnboardingStore((s) => s.branchName);
  const branchAddress = useOnboardingStore((s) => s.branchAddress);
  const singleBranchMode = useOnboardingStore((s) => s.singleBranchMode ?? true);
  const setSingleBranchMode = useOnboardingStore((s) => s.setSingleBranchMode);

  const [storeErrors, setStoreErrors] = useState<StoreInfoErrors>({});
  const slugAvailability = useTenantSlugAvailability(storeSlug, currentUser?.tenantId);

  useEffect(() => {
    if (!currentUser) navigate({ to: "/login" });
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!currentTenant || addBranchOnly) return;

    if (isPendingTenantName(currentTenant.name)) {
      if (!storeSlug.trim()) {
        updateStoreInfo({
          storeSlug: currentTenant.slug,
          storePhone: currentTenant.phone ?? "",
        });
      }
      return;
    }

    if (storeName.trim()) return;
    updateStoreInfo({
      storeName: currentTenant.name,
      storeSlug: currentTenant.slug,
      storePhone: currentTenant.phone ?? "",
      branchName: currentTenant.name,
    });
  }, [currentTenant, addBranchOnly, storeName, storeSlug, updateStoreInfo]);

  if (!currentUser) return null;
  if (addBranchOnly) return <AddBranchSetupPanel />;

  const currentIdx = step - 1;
  const summary = getSummary();
  const targetSlug = storeSlug.trim() || tenantSlug;

  const goNext = () => {
    if (step === 1) {
      if (!path) return toast.error("Pilih salah satu jalur setup");
      setStep(2);
    } else if (step === 2) {
      const errors = validateStoreInfo({
        storeName,
        storeSlug,
        storeAddress,
        storePhone,
        storeNpwp,
        branchName,
        branchAddress,
        singleBranchMode,
      });
      if (Object.keys(errors).length > 0) {
        setStoreErrors(errors);
        toast.error(firstValidationMessage(errors) ?? "Periksa data toko");
        return;
      }
      if (slugAvailability.isBlocking) {
        toast.error(
          slugAvailability.status === "taken"
            ? "URL toko sudah dipakai — pilih URL lain"
            : "Tunggu pemeriksaan ketersediaan URL...",
        );
        if (slugAvailability.status === "taken") {
          setStoreErrors((prev) => ({
            ...prev,
            storeSlug: "URL sudah dipakai — pilih URL lain",
          }));
        }
        return;
      }
      if (slugAvailability.status !== "available" && slugAvailability.status !== "idle") {
        toast.error("Periksa URL toko terlebih dahulu");
        return;
      }
      setStoreErrors({});
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      if (!path) return toast.error("Jalur setup tidak ditemukan");
      const { skippedProducts: skipped } = useOnboardingStore.getState();
      if (!skipped) {
        const productErr = validateProductsStep({
          path,
          products: useOnboardingStore.getState().products,
          bookRows: useOnboardingStore.getState().bookRows,
          excelRows: useOnboardingStore.getState().excelRows,
        });
        if (productErr) return toast.error(productErr);
      }
      setStep(5);
    }
  };

  const goBack = () => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4 | 5);
  };

  const handleFinish = async () => {
    const onboardingState = useOnboardingStore.getState();
    const storeValidation = validateStoreInfo({
      storeName: onboardingState.storeName,
      storeSlug: onboardingState.storeSlug,
      storeAddress: onboardingState.storeAddress,
      storePhone: onboardingState.storePhone,
      storeNpwp: onboardingState.storeNpwp,
      branchName: onboardingState.branchName,
      branchAddress: onboardingState.branchAddress,
      singleBranchMode: onboardingState.singleBranchMode !== false,
    });
    if (Object.keys(storeValidation).length > 0) {
      setStoreErrors(storeValidation);
      setStep(2);
      toast.error(firstValidationMessage(storeValidation) ?? "Lengkapi data toko terlebih dahulu");
      return;
    }
    if (onboardingState.path && !onboardingState.skippedProducts) {
      const productErr = validateProductsStep({
        path: onboardingState.path,
        products: onboardingState.products,
        bookRows: onboardingState.bookRows,
        excelRows: onboardingState.excelRows,
      });
      if (productErr) {
        setStep(4);
        toast.error(productErr);
        return;
      }
    }

    const dashboardSlug = isMockDemoUser(currentUser) ? tenantSlug : targetSlug;

    let branch;
    if (isNeonBackend()) {
      const branchName =
        onboardingState.singleBranchMode !== false
          ? onboardingState.storeName
          : onboardingState.branchName;
      const branchAddress =
        onboardingState.singleBranchMode !== false
          ? onboardingState.storeAddress
          : onboardingState.branchAddress;
      const code = branchName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3).padEnd(3, "X");
      const created = await finalizeOnboardingPrimaryBranch(currentUser.tenantId, {
        code,
        name: branchName.trim() || "Cabang Utama",
        address: branchAddress.trim() || null,
        phone: storePhone?.trim() || null,
        is_active: true,
      });
      if (created.error || !created.data) {
        toast.error(created.error ?? "Gagal menyiapkan cabang");
        return;
      }
      branch = created.data;
      useBranchStore.getState().setActiveBranch(branch);
      if (currentUser.profile?.id) {
        await assignUserToBranch(
          currentUser.tenantId,
          currentUser.profile.id,
          branch.id,
        );
      }
    } else {
      branch = useBranchStore.getState().applyOnboardingBranch({
        tenantId: currentUser.tenantId,
        name:
          onboardingState.singleBranchMode !== false
            ? onboardingState.storeName
            : onboardingState.branchName,
        address:
          onboardingState.singleBranchMode !== false
            ? onboardingState.storeAddress
            : onboardingState.branchAddress,
        phone: storePhone,
      });
    }

    if (isNeonBackend()) {
      await setLegacyMode(currentUser.tenantId, onboardingState.legacyMode);
      const tenantResult = await updateTenant(currentUser.tenantId, {
        name: onboardingState.storeName.trim(),
        slug: onboardingState.storeSlug.trim(),
        phone: onboardingState.storePhone.trim() || null,
        onboarding_complete: true,
      });
      if (tenantResult.error || !tenantResult.data) {
        toast.error(tenantResult.error ?? "Gagal menyimpan profil toko");
        return;
      }
      useAuthStore.setState({ currentTenant: tenantResult.data });
      useOnboardingStore.getState().completeOnboarding();
      await useBranchStore.getState().loadBranches(currentUser.tenantId);
    } else if (currentUser.tenantId === MOCK_TENANT_ID) {
      useAuthStore.getState().grantMockBranchAccess(MOCK_BRANCH_ONBOARDING);
      useAuthStore.getState().setMockTenantGoLiveFlags({
        legacyModeActive: onboardingState.legacyMode,
        onboardingComplete: true,
      });
      const ownerRecord = useUsersStore
        .getState()
        .listForTenant(currentUser.tenantId)
        .find((u) => u.role === "owner");
      if (ownerRecord && !ownerRecord.branchIds.includes(MOCK_BRANCH_ONBOARDING)) {
        useUsersStore.getState().updateUser(ownerRecord.id, {
          branchIds: [...ownerRecord.branchIds, MOCK_BRANCH_ONBOARDING],
        });
      }
    }

    const inventoryItems = collectOnboardingInventoryItems({
      path: onboardingState.path!,
      products: onboardingState.products,
      bookRows: onboardingState.bookRows,
      excelRows: onboardingState.excelRows,
      legacyMode: onboardingState.legacyMode,
    });

    let applied = 0;
    try {
      const result = await applyOnboardingInventoryToBranch(
        currentUser.tenantId,
        branch.id,
        inventoryItems,
      );
      applied = result.applied;
    } catch (err) {
      toast.warning(
        err instanceof Error
          ? `${err.message} — inventori bisa dilengkapi nanti di menu Produk.`
          : "Inventori gagal disimpan — bisa dilengkapi nanti di menu Produk.",
      );
    }

    const { users: onboardingUsers, skippedUsers } = onboardingState;
    if (!skippedUsers && onboardingUsers.length > 0) {
      const defaultBranchId = branch.id;
      for (const u of onboardingUsers) {
        if (isNeonBackend()) {
          const created = await createTenantUser(currentUser.tenantId, {
            name: u.name,
            email: u.email,
            role: u.role,
            pin: u.pin,
            branchIds: [defaultBranchId],
          });
          if (created.error) {
            toast.error(created.error);
            return;
          }
        } else {
          useUsersStore.getState().createUser(currentUser.tenantId, {
            name: u.name,
            email: u.email,
            role: u.role,
            pin: u.pin,
            branchIds: [defaultBranchId],
          });
        }
      }
    }

    completeOnboarding();
    toast.success(
      applied > 0
        ? `Setup selesai! ${applied} produk siap dijual di POS 🚀`
        : "Setup selesai! Selamat datang di SES 🚀",
    );
    useOnboardingStore.getState().finishWizardResume();
    const slug =
      useAuthStore.getState().currentTenant?.slug ??
      (isMockDemoUser(currentUser) ? tenantSlug : targetSlug);
    navigate({ to: "/$tenantSlug/dashboard", params: { tenantSlug: slug } });
  };

  return (
    <div className="min-h-screen bg-gradient-mesh flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-primary grid place-items-center shadow-glow mb-4">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Setup Toko Anda</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Langkah {step} dari 5 — wizard onboarding SES
          </p>
          {currentTenant?.onboarding_complete && (
            <Button
              variant="link"
              className="mt-2 text-sm"
              onClick={() => startAddBranchSetup()}
            >
              Tambah cabang baru saja →
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1 min-w-0">
              <div
                className={cn(
                  "h-7 w-7 rounded-full grid place-items-center text-xs font-bold shrink-0",
                  i <= currentIdx
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {i < currentIdx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs truncate hidden sm:inline",
                  i === currentIdx ? "font-medium" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px flex-1 min-w-2", i < currentIdx ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>

        <Card className="p-6">
          {step === 1 && <StepPathSelection selected={path} onSelect={setPath} />}
          {step === 2 && (
            <StepStoreInfo
              storeName={storeName}
              storeSlug={storeSlug}
              storeAddress={storeAddress}
              storePhone={storePhone}
              storeNpwp={storeNpwp}
              branchName={branchName}
              branchAddress={branchAddress}
              singleBranchMode={singleBranchMode}
              errors={storeErrors}
              onChange={(patch) => {
                updateStoreInfo(patch);
                setStoreErrors((prev) => {
                  const next = { ...prev };
                  for (const key of Object.keys(patch) as StoreInfoField[]) {
                    delete next[key];
                  }
                  return next;
                });
              }}
              onSingleBranchModeChange={(v) => {
                setSingleBranchMode(v);
                if (v) {
                  setStoreErrors((prev) => {
                    const { branchName: _b, branchAddress: _a, ...rest } = prev;
                    return rest;
                  });
                }
              }}
              slugAvailability={slugAvailability}
            />
          )}
          {step === 3 && <StepUsers />}
          {step === 4 && path && <StepProducts path={path} />}
          {step === 5 && (
            <StepComplete summary={summary} storeName={storeName} branchName={branchName} />
          )}

          <div className="flex gap-2 mt-6">
            {step > 1 && (
              <Button variant="outline" className="flex-1" onClick={goBack}>
                Kembali
              </Button>
            )}
            {step < 5 ? (
              <Button
                className="flex-1 bg-gradient-primary"
                onClick={goNext}
                disabled={step === 2 && slugAvailability.isBlocking}
              >
                Lanjut
              </Button>
            ) : (
              <Button className="flex-1 bg-gradient-primary text-base h-12" onClick={handleFinish}>
                Mulai Gunakan SES! 🚀
              </Button>
            )}
          </div>

          {step === 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-muted-foreground"
              onClick={() => {
                resetOnboarding();
                setStoreErrors({});
                toast.info("Wizard direset untuk demo");
              }}
            >
              Reset wizard (demo)
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}

function StepPathSelection({
  selected,
  onSelect,
}: {
  selected: OnboardingPath | null;
  onSelect: (p: OnboardingPath) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">Pilih Jalur Setup</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Sesuaikan dengan kondisi toko Anda saat ini
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PATHS.map((p) => {
          const Icon = p.icon;
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={cn(
                "text-left rounded-xl border p-4 transition-all hover:border-primary/50",
                active && "border-primary ring-2 ring-primary/20 bg-primary/5",
              )}
            >
              <Icon className={cn("h-6 w-6 mb-2", active ? "text-primary" : "text-muted-foreground")} />
              <div className="font-semibold">{p.title}</div>
              <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
              <Badge variant="secondary" className="mt-2 text-[10px]">
                {p.eta}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FieldHint({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-xs text-destructive mt-1">{error}</p>;
}

function StepStoreInfo({
  storeName,
  storeSlug,
  storeAddress,
  storePhone,
  storeNpwp,
  branchName,
  branchAddress,
  singleBranchMode,
  errors,
  slugAvailability,
  onChange,
  onSingleBranchModeChange,
}: {
  storeName: string;
  storeSlug: string;
  storeAddress: string;
  storePhone: string;
  storeNpwp: string;
  branchName: string;
  branchAddress: string;
  singleBranchMode: boolean;
  errors: StoreInfoErrors;
  slugAvailability: ReturnType<typeof useTenantSlugAvailability>;
  onChange: ReturnType<typeof useOnboardingStore.getState>["updateStoreInfo"];
  onSingleBranchModeChange: ReturnType<typeof useOnboardingStore.getState>["setSingleBranchMode"];
}) {
  const inputClass = (field: StoreInfoField) =>
    cn(errors[field] && "border-destructive focus-visible:ring-destructive/30");

  const slugHint =
    errors.storeSlug ??
    (slugAvailability.status === "taken" ? slugAvailability.message : undefined);
  const slugSuccess =
    !errors.storeSlug &&
    slugAvailability.status === "available" &&
    storeSlug.trim().length >= 3;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">Info Toko Anda</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Cukup isi data toko — untuk satu lokasi, cabang mengikuti otomatis
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="onb-store-name">
            Nama Toko <span className="text-destructive">*</span>
          </Label>
          <Input
            id="onb-store-name"
            value={storeName}
            onChange={(e) => onChange({ storeName: e.target.value })}
            placeholder="TB Lumayan"
            className={inputClass("storeName")}
            aria-invalid={!!errors.storeName}
          />
          <FieldHint error={errors.storeName} />
          <p className="text-xs text-muted-foreground">
            Nama toko boleh sama dengan toko lain — yang harus unik hanya URL di bawah.
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="onb-store-slug">
            URL Toko (slug) <span className="text-destructive">*</span>
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0">simetri.app/</span>
            <Input
              id="onb-store-slug"
              value={storeSlug}
              onChange={(e) =>
                onChange({
                  storeSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                })
              }
              className={cn(
                "flex-1",
                inputClass("storeSlug"),
                slugAvailability.status === "taken" && "border-destructive",
                slugSuccess && "border-success",
              )}
              aria-invalid={!!errors.storeSlug || slugAvailability.status === "taken"}
            />
          </div>
          <FieldHint error={slugHint} />
          {slugSuccess && (
            <p className="text-xs text-success mt-1">{slugAvailability.message}</p>
          )}
          {slugAvailability.status === "checking" && (
            <p className="text-xs text-muted-foreground mt-1">{slugAvailability.message}</p>
          )}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="onb-store-address">
            Alamat <span className="text-destructive">*</span>
          </Label>
          <Input
            id="onb-store-address"
            value={storeAddress}
            onChange={(e) => onChange({ storeAddress: e.target.value })}
            placeholder="Jl. Contoh No. 1, Kota"
            className={inputClass("storeAddress")}
            aria-invalid={!!errors.storeAddress}
          />
          <FieldHint error={errors.storeAddress} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="onb-store-phone">
            Telepon <span className="text-destructive">*</span>
          </Label>
          <Input
            id="onb-store-phone"
            value={storePhone}
            onChange={(e) => onChange({ storePhone: e.target.value })}
            placeholder="0812-3456-7890"
            className={inputClass("storePhone")}
            aria-invalid={!!errors.storePhone}
          />
          <FieldHint error={errors.storePhone} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="onb-store-npwp">NPWP (opsional)</Label>
          <Input
            id="onb-store-npwp"
            value={storeNpwp}
            onChange={(e) => onChange({ storeNpwp: e.target.value })}
            placeholder="01.234.567.8-901.000"
            className={inputClass("storeNpwp")}
            aria-invalid={!!errors.storeNpwp}
          />
          <FieldHint error={errors.storeNpwp} />
        </div>
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Satu lokasi / satu cabang</div>
            <div className="text-xs text-muted-foreground">
              Nama & alamat cabang sama dengan toko (disarankan untuk toko bangunan kecil)
            </div>
          </div>
          <Switch checked={singleBranchMode} onCheckedChange={onSingleBranchModeChange} />
        </div>

        {!singleBranchMode && (
          <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="onb-branch-name">
                Nama Cabang Pertama <span className="text-destructive">*</span>
              </Label>
              <Input
                id="onb-branch-name"
                value={branchName}
                onChange={(e) => onChange({ branchName: e.target.value })}
                placeholder="Cabang Tondano"
                className={inputClass("branchName")}
                aria-invalid={!!errors.branchName}
              />
              <FieldHint error={errors.branchName} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="onb-branch-address">
                Alamat Cabang <span className="text-destructive">*</span>
              </Label>
              <Input
                id="onb-branch-address"
                value={branchAddress}
                onChange={(e) => onChange({ branchAddress: e.target.value })}
                placeholder="Bisa berbeda dari alamat kantor pusat"
                className={inputClass("branchAddress")}
                aria-invalid={!!errors.branchAddress}
              />
              <FieldHint error={errors.branchAddress} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepUsers() {
  const users = useOnboardingStore((s) => s.users);
  const skippedUsers = useOnboardingStore((s) => s.skippedUsers);
  const addUser = useOnboardingStore((s) => s.addUser);
  const removeUser = useOnboardingStore((s) => s.removeUser);
  const setSkippedUsers = useOnboardingStore((s) => s.setSkippedUsers);

  const [draft, setDraft] = useState<Omit<OnboardingUserDraft, "id">>({
    name: "",
    email: "",
    pin: "",
    role: "cashier",
  });

  const handleAdd = () => {
    const err = validateOnboardingUser(draft);
    if (err) {
      toast.error(err);
      return;
    }
    addUser(draft);
    setDraft({ name: "", email: "", pin: "", role: "cashier" });
    setSkippedUsers(false);
    toast.success("Kasir ditambahkan");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Tambah User
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Minimal 1 kasir, atau skip jika hanya owner yang pakai dulu
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSkippedUsers(true);
            toast.info("User dilewati — bisa ditambah nanti dari pengaturan");
          }}
        >
          Skip
        </Button>
      </div>

      {skippedUsers && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          Anda memilih skip — hanya owner yang akan menggunakan sistem dulu.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nama</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Andi Pratama"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email (opsional)</Label>
          <Input
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder="andi@toko.id — kosongkan jika belum ada"
          />
        </div>
        <div className="space-y-1.5">
          <Label>PIN 6 digit</Label>
          <Input
            value={draft.pin}
            maxLength={6}
            onChange={(e) => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, "") })}
            placeholder="123456"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select
            value={draft.role}
            onValueChange={(v) => setDraft({ ...draft, role: v as UserRole })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cashier">Kasir</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="warehouse">Gudang</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button variant="secondary" onClick={handleAdd}>
        + Tambah Kasir
      </Button>

      {users.length > 0 && (
        <ul className="space-y-2 border rounded-lg divide-y">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-muted-foreground">
                  {u.role} · PIN ****{u.pin.slice(-2)}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeUser(u.id)}>
                Hapus
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepProducts({ path }: { path: OnboardingPath }) {
  const skippedProducts = useOnboardingStore((s) => s.skippedProducts);
  const setSkippedProducts = useOnboardingStore((s) => s.setSkippedProducts);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg">Setup Produk</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Opsional — bisa skip dan tambah produk nanti dari modul inventory
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSkippedProducts(true);
            toast.info("Produk dilewati — bisa ditambah nanti dari inventory");
          }}
        >
          Skip
        </Button>
      </div>

      {skippedProducts && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          Anda memilih skip — tidak ada produk awal yang akan ditambahkan.
        </div>
      )}

      {!skippedProducts && path === "new" && <StepProductsLibrary />}
      {!skippedProducts && path === "no-records" && <StepProductsNoRecords />}
      {!skippedProducts && path === "book" && <StepProductsBook />}
      {!skippedProducts && path === "excel" && <StepProductsExcel />}
    </div>
  );
}

function StepProductsLibrary() {
  const products = useOnboardingStore((s) => s.products);
  const toggleProduct = useOnboardingStore((s) => s.toggleProduct);
  const updateProduct = useOnboardingStore((s) => s.updateProduct);
  const setSkippedProducts = useOnboardingStore((s) => s.setSkippedProducts);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-base">Library Produk Toko Bangunan</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Centang produk yang dijual, atur harga jual dan stok awal
        </p>
      </div>
      <div className="grid gap-2 max-h-80 overflow-y-auto">
        {products.map((p) => (
          <div
            key={p.productId}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-lg border p-3",
              p.selected && "border-primary/40 bg-primary/5",
            )}
          >
            <Checkbox
              checked={p.selected}
              onCheckedChange={() => {
                setSkippedProducts(false);
                toggleProduct(p.productId);
              }}
            />
            <div className="flex-1 min-w-[140px]">
              <div className="font-medium text-sm">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.sku}</div>
            </div>
            {p.selected && (
              <>
                <div className="w-28">
                  <Label className="text-[10px]">Harga Jual</Label>
                  <Input
                    className="h-8 text-sm"
                    value={p.sellPrice ? p.sellPrice.toLocaleString("id-ID") : ""}
                    onChange={(e) =>
                      updateProduct(p.productId, {
                        sellPrice: Number(e.target.value.replace(/\D/g, "")),
                      })
                    }
                  />
                </div>
                <div className="w-20">
                  <Label className="text-[10px]">Stok awal</Label>
                  <Input
                    className="h-8 text-sm"
                    value={p.initialStock || ""}
                    onChange={(e) =>
                      updateProduct(p.productId, {
                        initialStock: Number(e.target.value.replace(/\D/g, "")),
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepProductsNoRecords() {
  const legacyMode = useOnboardingStore((s) => s.legacyMode);
  const setLegacyMode = useOnboardingStore((s) => s.setLegacyMode);
  const bookRows = useOnboardingStore((s) => s.bookRows);
  const addBookRow = useOnboardingStore((s) => s.addBookRow);
  const updateBookRow = useOnboardingStore((s) => s.updateBookRow);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">Produk Tanpa Catatan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Isi produk yang kamu jual — stok bisa dikosongkan dulu
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="text-sm font-medium">Mode toko tetap buka</div>
          <div className="text-xs text-muted-foreground">
            Kasir tetap bisa jual meski stok/opname belum lengkap. Matikan setelah stok
            sudah akurat.
          </div>
        </div>
        <Switch checked={legacyMode} onCheckedChange={setLegacyMode} />
      </div>
      <StepProductsBookTable
        rows={bookRows}
        onAdd={addBookRow}
        onUpdate={updateBookRow}
        showCategory={false}
      />
    </div>
  );
}

function StepProductsBook() {
  const bookRows = useOnboardingStore((s) => s.bookRows);
  const addBookRow = useOnboardingStore((s) => s.addBookRow);
  const updateBookRow = useOnboardingStore((s) => s.updateBookRow);

  const categories = [...new Set(bookRows.map((r) => r.category))];
  const filled = bookRows.filter((r) => r.name.trim()).length;
  const progress = bookRows.length ? Math.round((filled / bookRows.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">Input Massal (Catatan Buku)</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tekan Enter di baris terakhir untuk menambah baris baru
        </p>
      </div>
      <div className="rounded-lg bg-muted/40 p-3 text-xs">
        Progress per kategori:{" "}
        {categories.map((c) => (
          <Badge key={c} variant="secondary" className="mr-1">
            {c}
          </Badge>
        ))}{" "}
        · {progress}% baris terisi
      </div>
      <StepProductsBookTable rows={bookRows} onAdd={addBookRow} onUpdate={updateBookRow} />
    </div>
  );
}

function StepProductsBookTable({
  rows,
  onAdd,
  onUpdate,
  showCategory = true,
}: {
  rows: ReturnType<typeof useOnboardingStore.getState>["bookRows"];
  onAdd: () => void;
  onUpdate: ReturnType<typeof useOnboardingStore.getState>["updateBookRow"];
  showCategory?: boolean;
}) {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="text-left p-2">Nama</th>
            {showCategory && <th className="text-left p-2">Kategori</th>}
            <th className="text-left p-2">Satuan</th>
            <th className="text-right p-2">Harga Jual</th>
            <th className="text-right p-2">Stok</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, idx) => (
            <tr key={row.id}>
              <td className="p-1">
                <Input
                  className="h-8"
                  value={row.name}
                  onChange={(e) => onUpdate(row.id, { name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && idx === rows.length - 1) onAdd();
                  }}
                  placeholder="Nama produk"
                />
              </td>
              {showCategory && (
                <td className="p-1">
                  <Input
                    className="h-8"
                    value={row.category}
                    onChange={(e) => onUpdate(row.id, { category: e.target.value })}
                  />
                </td>
              )}
              <td className="p-1">
                <Input
                  className="h-8 w-20"
                  value={row.unit}
                  onChange={(e) => onUpdate(row.id, { unit: e.target.value })}
                />
              </td>
              <td className="p-1">
                <Input
                  className="h-8 w-24 text-right"
                  value={row.sellPrice ? row.sellPrice.toLocaleString("id-ID") : ""}
                  onChange={(e) =>
                    onUpdate(row.id, { sellPrice: Number(e.target.value.replace(/\D/g, "")) })
                  }
                />
              </td>
              <td className="p-1">
                <Input
                  className="h-8 w-16 text-right"
                  value={row.stock || ""}
                  onChange={(e) =>
                    onUpdate(row.id, { stock: Number(e.target.value.replace(/\D/g, "")) })
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2 border-t">
        <Button variant="ghost" size="sm" onClick={onAdd}>
          + Tambah Baris
        </Button>
      </div>
    </div>
  );
}

function StepProductsExcel() {
  const excelRows = useOnboardingStore((s) => s.excelRows);
  const setExcelRows = useOnboardingStore((s) => s.setExcelRows);
  const demoMode = !isNeonBackend();

  const handleDownload = () => {
    toast.success(demoMode ? "Template Excel diunduh (mock)" : "Template Excel diunduh");
  };

  const handleUpload = () => {
    if (!demoMode) {
      toast.info("Upload file Excel belum tersedia — gunakan jalur Buku Catatan atau Toko Baru");
      return;
    }
    const mock: ReturnType<typeof useOnboardingStore.getState>["excelRows"] = [
      { row: 1, sku: "BRG-001", name: "Semen Portland 50kg", sellPrice: 65000, stock: 50, valid: true },
      { row: 2, sku: "", name: "Produk Tanpa SKU", sellPrice: 25000, stock: 10, valid: false, error: "SKU wajib diisi" },
      { row: 3, sku: "BRG-099", name: "Paku 5cm", sellPrice: 15000, stock: 200, valid: true },
    ];
    setExcelRows(mock);
    toast.success("2 dari 3 baris valid — 1 baris dilewati");
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">Import dari Excel</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Unduh template, upload file, preview validasi per baris
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1.5" /> Download Template
        </Button>
      </div>
      <button
        type="button"
        onClick={handleUpload}
        disabled={!demoMode}
        className="w-full border-2 border-dashed rounded-xl p-8 text-center hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <div className="font-medium">Drag & drop file Excel di sini</div>
        <div className="text-xs text-muted-foreground mt-1">
          {demoMode
            ? "atau klik untuk simulasi upload (mock)"
            : "Upload Excel segera hadir — pilih jalur Buku Catatan atau Toko Baru"}
        </div>
      </button>
      {excelRows.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Baris</th>
                <th className="p-2 text-left">SKU</th>
                <th className="p-2 text-left">Nama</th>
                <th className="p-2 text-right">Harga</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {excelRows.map((r) => (
                <tr key={r.row}>
                  <td className="p-2">{r.row}</td>
                  <td className="p-2 font-mono text-xs">{r.sku || "—"}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-right">{rupiah(r.sellPrice)}</td>
                  <td className="p-2 text-center">
                    {r.valid ? (
                      <Badge className="bg-success/15 text-success border-0">OK</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">
                        {r.error}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StepComplete({
  summary,
  storeName,
  branchName,
}: {
  summary: ReturnType<typeof useOnboardingStore.getState>["getSummary"] extends () => infer R
    ? R
    : never;
  storeName: string;
  branchName: string;
}) {
  return (
    <div className="text-center py-2">
      <div className="h-16 w-16 mx-auto rounded-full bg-gradient-success grid place-items-center mb-4">
        <CheckCircle2 className="h-8 w-8 text-white" />
      </div>
      <h2 className="font-semibold text-lg">Siap Go Live!</h2>
      <p className="text-sm text-muted-foreground mt-2">
        <strong>{storeName || "Toko Anda"}</strong>
        {branchName && branchName !== storeName && (
          <>
            {" "}
            · cabang <strong>{branchName}</strong>
          </>
        )}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="text-2xl font-bold">{summary.productCount}</div>
          <div className="text-xs text-muted-foreground">Produk</div>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="text-2xl font-bold">{summary.branchCount}</div>
          <div className="text-xs text-muted-foreground">Cabang</div>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="text-2xl font-bold">{summary.userCount}</div>
          <div className="text-xs text-muted-foreground">User</div>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-muted p-3 text-xs text-left space-y-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Tenant & cabang dikonfigurasi
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Produk siap dijual di POS
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> RLS & multi-tenant aktif
        </div>
      </div>
    </div>
  );
}

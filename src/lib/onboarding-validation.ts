// =============================================================================
// Onboarding form validation
// =============================================================================

import type {
  BookProductRow,
  ExcelImportRow,
  OnboardingPath,
  OnboardingProductDraft,
  OnboardingUserDraft,
} from "@/stores/onboarding.store";

export type StoreInfoField =
  | "storeName"
  | "storeSlug"
  | "storeAddress"
  | "storePhone"
  | "storeNpwp"
  | "branchName"
  | "branchAddress";

export type StoreInfoErrors = Partial<Record<StoreInfoField, string>>;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHONE_RE = /^[\d\s+\-()]{8,20}$/;
const NPWP_RE = /^[\d.\-]{10,20}$/;

export function validateStoreSlug(slug: string): string | undefined {
  const s = slug.trim();
  if (!s) return "URL toko wajib diisi";
  if (s.length < 3) return "URL minimal 3 karakter";
  if (s.length > 48) return "URL maksimal 48 karakter";
  if (!SLUG_RE.test(s)) return "Hanya huruf kecil, angka, dan tanda hubung (-)";
  return undefined;
}

export function validateStoreInfo(input: {
  storeName: string;
  storeSlug: string;
  storeAddress: string;
  storePhone: string;
  storeNpwp: string;
  branchName: string;
  branchAddress: string;
  singleBranchMode: boolean;
}): StoreInfoErrors {
  const errors: StoreInfoErrors = {};

  const name = input.storeName.trim();
  if (!name) errors.storeName = "Nama toko wajib diisi";
  else if (name.length < 2) errors.storeName = "Nama toko minimal 2 karakter";
  else if (name.length > 120) errors.storeName = "Nama toko maksimal 120 karakter";

  const slugErr = validateStoreSlug(input.storeSlug);
  if (slugErr) errors.storeSlug = slugErr;

  const address = input.storeAddress.trim();
  if (!address) errors.storeAddress = "Alamat wajib diisi";
  else if (address.length < 5) errors.storeAddress = "Alamat terlalu singkat (min. 5 karakter)";

  const phone = input.storePhone.trim();
  if (!phone) errors.storePhone = "Nomor telepon wajib diisi";
  else if (!PHONE_RE.test(phone)) errors.storePhone = "Format telepon tidak valid (min. 8 digit)";

  const npwp = input.storeNpwp.trim();
  if (npwp && !NPWP_RE.test(npwp)) {
    errors.storeNpwp = "Format NPWP tidak valid";
  }

  if (!input.singleBranchMode) {
    const branchName = input.branchName.trim();
    if (!branchName) errors.branchName = "Nama cabang wajib diisi";
    else if (branchName.length < 2) errors.branchName = "Nama cabang minimal 2 karakter";

    const branchAddress = input.branchAddress.trim();
    if (!branchAddress) errors.branchAddress = "Alamat cabang wajib diisi";
    else if (branchAddress.length < 5) errors.branchAddress = "Alamat cabang terlalu singkat";
  }

  return errors;
}

export function firstValidationMessage(errors: StoreInfoErrors): string | undefined {
  const order: StoreInfoField[] = [
    "storeName",
    "storeSlug",
    "storeAddress",
    "storePhone",
    "storeNpwp",
    "branchName",
    "branchAddress",
  ];
  for (const key of order) {
    if (errors[key]) return errors[key];
  }
  return undefined;
}

export function validateOnboardingUser(
  draft: Omit<OnboardingUserDraft, "id">,
): string | undefined {
  if (!draft.name.trim()) return "Nama pegawai wajib diisi";
  if (draft.name.trim().length < 2) return "Nama minimal 2 karakter";
  if (draft.pin.length !== 6) return "PIN harus 6 digit";
  if (!/^\d{6}$/.test(draft.pin)) return "PIN hanya boleh angka";
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    return "Format email tidak valid";
  }
  return undefined;
}

export function validateProductsStep(input: {
  path: OnboardingPath;
  products: OnboardingProductDraft[];
  bookRows: BookProductRow[];
  excelRows: ExcelImportRow[];
}): string | undefined {
  const { path, products, bookRows, excelRows } = input;

  if (path === "new") {
    const selected = products.filter((p) => p.selected);
    if (selected.length === 0) return "Pilih minimal 1 produk dari library";
    const invalid = selected.find((p) => !p.sellPrice || p.sellPrice <= 0);
    if (invalid) return `Harga jual "${invalid.name}" harus lebih dari 0`;
    return undefined;
  }

  if (path === "excel") {
    const valid = excelRows.filter((r) => r.valid && r.name.trim());
    if (valid.length === 0) return "Upload Excel dan pastikan ada baris valid";
    const badPrice = valid.find((r) => !r.sellPrice || r.sellPrice <= 0);
    if (badPrice) return `Baris ${badPrice.row}: harga jual harus lebih dari 0`;
    return undefined;
  }

  // book + no-records
  const rows = bookRows.filter((r) => r.name.trim());
  if (rows.length === 0) return "Isi minimal 1 nama produk";
  const noPrice = rows.find((r) => !r.sellPrice || r.sellPrice <= 0);
  if (noPrice) return `Harga jual "${noPrice.name.trim()}" harus lebih dari 0`;
  const noUnit = rows.find((r) => !r.unit.trim());
  if (noUnit) return `Satuan "${noUnit.name.trim()}" wajib diisi`;
  return undefined;
}

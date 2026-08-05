// =============================================================================
// Product Catalog Store — katalog platform (developer) + cache lokal semua toko
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  CATALOG_SEED_VERSION,
  getSeedPlatformCatalogPayload,
  getSeedProductCatalog,
  normalizePlatformCatalogPayload,
} from "@/lib/product-catalog-seed";
import { resolveCategoryForAttributes } from "@/lib/category-attribute-map";
import { suggestAbbreviation } from "@/lib/product-name-builder";
import type {
  CatalogCategory,
  GlobalAttribute,
  PlatformCatalogPayload,
  ProductType,
  ProductTypeAttribute,
  ProductAttributeValue,
  ResolvedProductTypeAttribute,
} from "@/types/product-attributes";

interface ProductCatalogState {
  catalogCategories: CatalogCategory[];
  globalAttributes: GlobalAttribute[];
  productTypes: ProductType[];
  typeAttributes: ProductTypeAttribute[];
  seeded: boolean;
  seedVersion: number;
  publishedVersion: number;
  /** true = toko hanya baca; false = developer sedang edit draft */
  catalogReadOnly: boolean;

  seedIfEmpty: () => void;
  setCatalogReadOnly: (readOnly: boolean) => void;
  loadFromPayload: (payload: PlatformCatalogPayload) => void;
  getPayload: () => PlatformCatalogPayload;
  applySeedFromDeveloper: () => void;

  listCategories: (includeInactive?: boolean) => string[];
  listCatalogCategories: (includeInactive?: boolean) => CatalogCategory[];
  listGlobalAttributes: (includeInactive?: boolean) => GlobalAttribute[];
  listProductTypesForCategory: (categoryName: string, includeInactive?: boolean) => ProductType[];
  listAttributesForProductType: (
    productTypeId: string,
    includeInactive?: boolean,
  ) => ResolvedProductTypeAttribute[];
  getProductType: (productTypeId: string) => ProductType | undefined;
  getCategoryByName: (name: string) => CatalogCategory | undefined;

  addCategory: (name: string, description?: string) => { ok: boolean; error?: string; id?: string };
  updateCategory: (
    id: string,
    patch: Partial<Pick<CatalogCategory, "name" | "description" | "isActive">>,
  ) => { ok: boolean; error?: string };
  reorderCategory: (id: string, direction: "up" | "down") => void;

  addGlobalAttribute: (name: string) => { ok: boolean; error?: string; id?: string };
  updateGlobalAttribute: (
    id: string,
    patch: Partial<Pick<GlobalAttribute, "name" | "isActive">>,
  ) => { ok: boolean; error?: string };

  addProductType: (
    categoryName: string,
    name: string,
    abbreviation?: string,
  ) => { ok: boolean; error?: string; id?: string };
  updateProductType: (
    id: string,
    patch: Partial<Pick<ProductType, "name" | "abbreviation" | "isActive">>,
  ) => { ok: boolean; error?: string };
  reorderProductType: (id: string, direction: "up" | "down") => void;

  assignGlobalAttribute: (
    productTypeId: string,
    globalAttributeId: string,
  ) => { ok: boolean; error?: string; id?: string };
  removeTypeAttribute: (assignmentId: string) => { ok: boolean; error?: string };
  updateTypeAttribute: (
    assignmentId: string,
    patch: Partial<Pick<ProductTypeAttribute, "isActive">>,
  ) => { ok: boolean; error?: string };
  reorderTypeAttribute: (assignmentId: string, direction: "up" | "down") => void;

  addTypeAttributeValue: (
    assignmentId: string,
    label: string,
    abbreviation?: string,
  ) => { ok: boolean; error?: string; id?: string };
  updateTypeAttributeValue: (
    assignmentId: string,
    valueId: string,
    patch: Partial<Pick<ProductAttributeValue, "label" | "abbreviation" | "isActive">>,
  ) => { ok: boolean; error?: string };
  reorderTypeAttributeValue: (
    assignmentId: string,
    valueId: string,
    direction: "up" | "down",
  ) => void;
}

let nextCatSeq = 1000;
let nextGaSeq = 2000;
let nextPtSeq = 3000;
let nextTaSeq = 4000;
let nextValSeq = 5000;

function nextCatId(): string {
  nextCatSeq += 1;
  return `cat-custom-${nextCatSeq}`;
}
function nextGaId(): string {
  nextGaSeq += 1;
  return `ga-custom-${nextGaSeq}`;
}
function nextPtId(): string {
  nextPtSeq += 1;
  return `pt-custom-${nextPtSeq}`;
}
function nextTaId(): string {
  nextTaSeq += 1;
  return `ta-custom-${nextTaSeq}`;
}
function nextValId(): string {
  nextValSeq += 1;
  return `val-custom-${nextValSeq}`;
}

function reorderList<T extends { sortOrder: number; id: string }>(
  items: T[],
  id: string,
  direction: "up" | "down",
): T[] {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((i) => i.id === id);
  if (idx < 0) return items;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return items;
  const next = [...sorted];
  const a = next[idx];
  const b = next[swapIdx];
  next[idx] = { ...a, sortOrder: b.sortOrder };
  next[swapIdx] = { ...b, sortOrder: a.sortOrder };
  return next;
}

function resolveTypeAttributes(
  typeAttributes: ProductTypeAttribute[],
  globalAttributes: GlobalAttribute[],
  productTypeId: string,
  includeInactive = false,
): ResolvedProductTypeAttribute[] {
  const gaById = new Map(globalAttributes.map((g) => [g.id, g]));
  return typeAttributes
    .filter((ta) => ta.productTypeId === productTypeId && (includeInactive || ta.isActive))
    .map((ta) => {
      const ga = gaById.get(ta.globalAttributeId);
      return {
        assignmentId: ta.id,
        globalAttributeId: ta.globalAttributeId,
        name: ga?.name ?? "?",
        sortOrder: ta.sortOrder,
        isActive: ta.isActive && (ga?.isActive ?? true),
        values: ta.values,
      };
    })
    .filter((r) => includeInactive || r.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function guardEdit(get: () => ProductCatalogState): { ok: true } | { ok: false; error: string } {
  if (get().catalogReadOnly) {
    return { ok: false, error: "Master data dikelola developer — gunakan fitur Request" };
  }
  return { ok: true };
}

function applySeedState(): ProductCatalogState {
  const seed = getSeedProductCatalog();
  return {
    catalogCategories: seed.catalogCategories,
    globalAttributes: seed.globalAttributes,
    productTypes: seed.productTypes,
    typeAttributes: seed.typeAttributes,
    seeded: true,
    seedVersion: CATALOG_SEED_VERSION,
    publishedVersion: CATALOG_SEED_VERSION,
    catalogReadOnly: true,
  };
}

export const useProductAttributesStore = create<ProductCatalogState>()(
  persist(
    (set, get) => ({
      catalogCategories: [],
      globalAttributes: [],
      productTypes: [],
      typeAttributes: [],
      seeded: false,
      seedVersion: 0,
      publishedVersion: 0,
      catalogReadOnly: true,

      seedIfEmpty: () => {
        const { seeded, seedVersion, catalogCategories } = get();
        const outdated = seedVersion < CATALOG_SEED_VERSION;
        const cats = catalogCategories ?? [];
        if (seeded && cats.length > 0 && !outdated) return;
        set(applySeedState());
      },

      setCatalogReadOnly: (readOnly) => set({ catalogReadOnly: readOnly }),

      loadFromPayload: (payload) => {
        const normalized = normalizePlatformCatalogPayload(payload);
        set({
          catalogCategories: normalized.catalogCategories,
          globalAttributes: normalized.globalAttributes,
          productTypes: normalized.productTypes,
          typeAttributes: normalized.typeAttributes,
          seeded: true,
          seedVersion: normalized.version,
          publishedVersion: normalized.version,
          catalogReadOnly: true,
        });
      },

      getPayload: () => {
        const s = get();
        return {
          version: Math.max(s.publishedVersion, CATALOG_SEED_VERSION) + 1,
          catalogCategories: s.catalogCategories,
          globalAttributes: s.globalAttributes,
          productTypes: s.productTypes,
          typeAttributes: s.typeAttributes,
          publishedAt: new Date().toISOString(),
        };
      },

      applySeedFromDeveloper: () => {
        const payload = getSeedPlatformCatalogPayload();
        set({
          ...payload,
          seeded: true,
          seedVersion: payload.version,
          publishedVersion: payload.version,
        });
      },

      listCategories: (includeInactive = false) =>
        get()
          .listCatalogCategories(includeInactive)
          .map((c) => c.name),

      listCatalogCategories: (includeInactive = false) =>
        (get().catalogCategories ?? [])
          .filter((c) => includeInactive || c.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder),

      listGlobalAttributes: (includeInactive = false) =>
        get()
          .globalAttributes.filter((g) => includeInactive || g.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder),

      listProductTypesForCategory: (categoryName, includeInactive = false) => {
        const canonical = resolveCategoryForAttributes(categoryName);
        return get()
          .productTypes.filter(
            (pt) => pt.categoryName === canonical && (includeInactive || pt.isActive),
          )
          .sort((a, b) => a.sortOrder - b.sortOrder);
      },

      listAttributesForProductType: (productTypeId, includeInactive = false) =>
        resolveTypeAttributes(
          get().typeAttributes,
          get().globalAttributes,
          productTypeId,
          includeInactive,
        ),

      getProductType: (productTypeId) => get().productTypes.find((pt) => pt.id === productTypeId),

      getCategoryByName: (name) => {
        const canonical = resolveCategoryForAttributes(name);
        return get().catalogCategories.find(
          (c) => c.name === canonical || c.name === name.trim(),
        );
      },

      addCategory: (name, description) => {
        const g = guardEdit(get);
        if (!g.ok) return g;
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: "Nama kategori wajib diisi" };
        const cats = get().catalogCategories ?? [];
        const exists = cats.some(
          (c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.isActive,
        );
        if (exists) return { ok: false, error: "Kategori sudah ada" };
        const id = nextCatId();
        const maxOrder = cats.reduce((m, c) => Math.max(m, c.sortOrder), 0);
        set((s) => ({
          catalogCategories: [
            ...(s.catalogCategories ?? []),
            {
              id,
              name: trimmed,
              description: description?.trim() || undefined,
              sortOrder: maxOrder + 1,
              isActive: true,
            },
          ],
        }));
        return { ok: true, id };
      },

      updateCategory: (id, patch) => {
        const g = guardEdit(get);
        if (!g.ok) return g;
        const cat = get().catalogCategories.find((c) => c.id === id);
        if (!cat) return { ok: false, error: "Kategori tidak ditemukan" };
        const newName = patch.name?.trim();
        if (newName && newName !== cat.name) {
          const dup = get().catalogCategories.some(
            (c) => c.id !== id && c.name.toLowerCase() === newName.toLowerCase() && c.isActive,
          );
          if (dup) return { ok: false, error: "Nama kategori sudah dipakai" };
          set((s) => ({
            catalogCategories: s.catalogCategories.map((c) =>
              c.id === id ? { ...c, ...patch, name: newName } : c,
            ),
            productTypes: s.productTypes.map((pt) =>
              pt.categoryName === cat.name ? { ...pt, categoryName: newName } : pt,
            ),
          }));
          return { ok: true };
        }
        set((s) => ({
          catalogCategories: s.catalogCategories.map((c) =>
            c.id === id ? { ...c, ...patch, name: newName ?? c.name } : c,
          ),
        }));
        return { ok: true };
      },

      reorderCategory: (id, direction) => {
        if (guardEdit(get).ok === false) return;
        const reordered = reorderList(get().catalogCategories, id, direction);
        set({ catalogCategories: reordered });
      },

      addGlobalAttribute: (name) => {
        const g = guardEdit(get);
        if (!g.ok) return g;
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: "Nama atribut wajib diisi" };
        const exists = get().globalAttributes.some(
          (ga) => ga.name.toLowerCase() === trimmed.toLowerCase() && ga.isActive,
        );
        if (exists) return { ok: false, error: "Atribut global sudah ada" };
        const id = nextGaId();
        const maxOrder = get().globalAttributes.reduce((m, ga) => Math.max(m, ga.sortOrder), 0);
        set((s) => ({
          globalAttributes: [
            ...s.globalAttributes,
            { id, name: trimmed, sortOrder: maxOrder + 1, isActive: true },
          ],
        }));
        return { ok: true, id };
      },

      updateGlobalAttribute: (id, patch) => {
        const g = guardEdit(get);
        if (!g.ok) return g;
        const ga = get().globalAttributes.find((x) => x.id === id);
        if (!ga) return { ok: false, error: "Atribut tidak ditemukan" };
        if (patch.name?.trim()) {
          const dup = get().globalAttributes.some(
            (x) =>
              x.id !== id &&
              x.name.toLowerCase() === patch.name!.trim().toLowerCase() &&
              x.isActive,
          );
          if (dup) return { ok: false, error: "Nama atribut sudah dipakai" };
        }
        set((s) => ({
          globalAttributes: s.globalAttributes.map((x) =>
            x.id === id
              ? { ...x, ...patch, name: patch.name?.trim() ? patch.name.trim() : x.name }
              : x,
          ),
        }));
        return { ok: true };
      },

      addProductType: (categoryName, name, abbreviation) => {
        const g = guardEdit(get);
        if (!g.ok) return g;
        const canonical = resolveCategoryForAttributes(categoryName);
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: "Nama jenis barang wajib diisi" };
        const exists = get().productTypes.some(
          (pt) =>
            pt.categoryName === canonical &&
            pt.name.toLowerCase() === trimmed.toLowerCase() &&
            pt.isActive,
        );
        if (exists) return { ok: false, error: "Jenis barang sudah ada di kategori ini" };
        const id = nextPtId();
        const abbr = (abbreviation?.trim() || suggestAbbreviation(trimmed)).toUpperCase();
        const maxOrder = get()
          .productTypes.filter((pt) => pt.categoryName === canonical)
          .reduce((m, pt) => Math.max(m, pt.sortOrder), 0);
        set((s) => ({
          productTypes: [
            ...s.productTypes,
            {
              id,
              categoryName: canonical,
              name: trimmed,
              abbreviation: abbr,
              sortOrder: maxOrder + 1,
              isActive: true,
            },
          ],
        }));
        return { ok: true, id };
      },

      updateProductType: (id, patch) => {
        const g = guardEdit(get);
        if (!g.ok) return g;
        const pt = get().productTypes.find((p) => p.id === id);
        if (!pt) return { ok: false, error: "Jenis barang tidak ditemukan" };
        if (patch.name?.trim()) {
          const dup = get().productTypes.some(
            (p) =>
              p.id !== id &&
              p.categoryName === pt.categoryName &&
              p.name.toLowerCase() === patch.name!.trim().toLowerCase() &&
              p.isActive,
          );
          if (dup) return { ok: false, error: "Nama jenis barang sudah dipakai" };
        }
        set((s) => ({
          productTypes: s.productTypes.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...patch,
                  name: patch.name?.trim() ? patch.name.trim() : p.name,
                  abbreviation: patch.abbreviation?.trim()
                    ? patch.abbreviation.trim().toUpperCase()
                    : p.abbreviation,
                }
              : p,
          ),
        }));
        return { ok: true };
      },

      reorderProductType: (id, direction) => {
        if (!guardEdit(get).ok) return;
        const pt = get().productTypes.find((p) => p.id === id);
        if (!pt) return;
        const siblings = get().productTypes.filter((p) => p.categoryName === pt.categoryName);
        const reordered = reorderList(siblings, id, direction);
        set((s) => ({
          productTypes: s.productTypes.map((p) => {
            const updated = reordered.find((r) => r.id === p.id);
            return updated ? { ...p, sortOrder: updated.sortOrder } : p;
          }),
        }));
      },

      assignGlobalAttribute: (productTypeId, globalAttributeId) => {
        const g = guardEdit(get);
        if (!g.ok) return g;
        const pt = get().productTypes.find((p) => p.id === productTypeId);
        if (!pt) return { ok: false, error: "Jenis barang tidak ditemukan" };
        const ga = get().globalAttributes.find((x) => x.id === globalAttributeId);
        if (!ga) return { ok: false, error: "Atribut global tidak ditemukan" };
        const exists = get().typeAttributes.some(
          (ta) =>
            ta.productTypeId === productTypeId &&
            ta.globalAttributeId === globalAttributeId &&
            ta.isActive,
        );
        if (exists) return { ok: false, error: "Atribut sudah di-assign ke jenis ini" };
        const id = nextTaId();
        const maxOrder = get()
          .typeAttributes.filter((ta) => ta.productTypeId === productTypeId)
          .reduce((m, ta) => Math.max(m, ta.sortOrder), 0);
        set((s) => ({
          typeAttributes: [
            ...s.typeAttributes,
            {
              id,
              productTypeId,
              globalAttributeId,
              sortOrder: maxOrder + 1,
              isActive: true,
              values: [],
            },
          ],
        }));
        return { ok: true, id };
      },

      removeTypeAttribute: (assignmentId) => {
        const g = guardEdit(get);
        if (!g.ok) return g;
        if (!get().typeAttributes.some((ta) => ta.id === assignmentId)) {
          return { ok: false, error: "Assignment tidak ditemukan" };
        }
        set((s) => ({
          typeAttributes: s.typeAttributes.filter((ta) => ta.id !== assignmentId),
        }));
        return { ok: true };
      },

      updateTypeAttribute: (assignmentId, patch) => {
        const g = guardEdit(get);
        if (!g.ok) return g;
        if (!get().typeAttributes.some((ta) => ta.id === assignmentId)) {
          return { ok: false, error: "Assignment tidak ditemukan" };
        }
        set((s) => ({
          typeAttributes: s.typeAttributes.map((ta) =>
            ta.id === assignmentId ? { ...ta, ...patch } : ta,
          ),
        }));
        return { ok: true };
      },

      reorderTypeAttribute: (assignmentId, direction) => {
        if (!guardEdit(get).ok) return;
        const ta = get().typeAttributes.find((t) => t.id === assignmentId);
        if (!ta) return;
        const siblings = get().typeAttributes.filter((t) => t.productTypeId === ta.productTypeId);
        const reordered = reorderList(siblings, assignmentId, direction);
        set((s) => ({
          typeAttributes: s.typeAttributes.map((t) => {
            const updated = reordered.find((r) => r.id === t.id);
            return updated ? { ...t, sortOrder: updated.sortOrder } : t;
          }),
        }));
      },

      addTypeAttributeValue: (assignmentId, label, abbreviation) => {
        const g = guardEdit(get);
        if (!g.ok) return g;
        const trimmed = label.trim();
        if (!trimmed) return { ok: false, error: "Nilai wajib diisi" };
        const ta = get().typeAttributes.find((t) => t.id === assignmentId);
        if (!ta) return { ok: false, error: "Assignment tidak ditemukan" };
        const abbr = (abbreviation?.trim() || suggestAbbreviation(trimmed)).toUpperCase();
        const id = nextValId();
        const maxOrder = ta.values.reduce((m, v) => Math.max(m, v.sortOrder), 0);
        set((s) => ({
          typeAttributes: s.typeAttributes.map((t) =>
            t.id === assignmentId
              ? {
                  ...t,
                  values: [
                    ...t.values,
                    {
                      id,
                      label: trimmed,
                      abbreviation: abbr,
                      sortOrder: maxOrder + 1,
                      isActive: true,
                    },
                  ],
                }
              : t,
          ),
        }));
        return { ok: true, id };
      },

      updateTypeAttributeValue: (assignmentId, valueId, patch) => {
        const g = guardEdit(get);
        if (!g.ok) return g;
        const ta = get().typeAttributes.find((t) => t.id === assignmentId);
        if (!ta) return { ok: false, error: "Assignment tidak ditemukan" };
        set((s) => ({
          typeAttributes: s.typeAttributes.map((t) =>
            t.id === assignmentId
              ? {
                  ...t,
                  values: t.values.map((v) =>
                    v.id === valueId
                      ? {
                          ...v,
                          ...patch,
                          label: patch.label?.trim() ? patch.label.trim() : v.label,
                          abbreviation: patch.abbreviation?.trim()
                            ? patch.abbreviation.trim().toUpperCase()
                            : v.abbreviation,
                        }
                      : v,
                  ),
                }
              : t,
          ),
        }));
        return { ok: true };
      },

      reorderTypeAttributeValue: (assignmentId, valueId, direction) => {
        if (!guardEdit(get).ok) return;
        set((s) => ({
          typeAttributes: s.typeAttributes.map((t) => {
            if (t.id !== assignmentId) return t;
            return { ...t, values: reorderList(t.values, valueId, direction) };
          }),
        }));
      },
    }),
    {
      name: "ses-platform-catalog-published",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.seedIfEmpty();
      },
      migrate: (persisted: unknown) => {
        const state = persisted as Partial<ProductCatalogState> & {
          attributes?: unknown[];
          seedVersion?: number;
        };
        if (
          !state.catalogCategories?.length ||
          (state.seedVersion ?? 0) < CATALOG_SEED_VERSION
        ) {
          return applySeedState();
        }
        return {
          ...applySeedState(),
          ...state,
          catalogCategories: state.catalogCategories ?? [],
          globalAttributes: state.globalAttributes ?? [],
          productTypes: state.productTypes ?? [],
          typeAttributes: state.typeAttributes ?? [],
          catalogReadOnly: true,
        };
      },
      version: 3,
    },
  ),
);

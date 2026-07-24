// =============================================================================
// Product Attributes Store — definisi fleksibel per kategori (localStorage demo).
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { allowMockDataSeeding } from "@/lib/mock-data-guard";
import {
  getSeedProductAttributes,
  SEED_PRODUCT_ATTRIBUTE_CATEGORIES,
} from "@/lib/mock-product-attributes";
import { suggestAbbreviation } from "@/lib/product-name-builder";
import type { ProductAttributeDefinition, ProductAttributeValue } from "@/types/product-attributes";

interface ProductAttributesState {
  attributes: ProductAttributeDefinition[];
  seeded: boolean;

  seedIfEmpty: () => void;
  listCategories: () => string[];
  listForCategory: (categoryName: string, includeInactive?: boolean) => ProductAttributeDefinition[];

  addAttribute: (categoryName: string, name: string) => { ok: boolean; error?: string; id?: string };
  updateAttribute: (
    id: string,
    patch: Partial<Pick<ProductAttributeDefinition, "name" | "isActive">>,
  ) => { ok: boolean; error?: string };
  reorderAttribute: (id: string, direction: "up" | "down") => void;

  addValue: (
    attributeId: string,
    label: string,
    abbreviation?: string,
  ) => { ok: boolean; error?: string; id?: string };
  updateValue: (
    attributeId: string,
    valueId: string,
    patch: Partial<Pick<ProductAttributeValue, "label" | "abbreviation" | "isActive">>,
  ) => { ok: boolean; error?: string };
  reorderValue: (attributeId: string, valueId: string, direction: "up" | "down") => void;
}

let nextAttrSeq = 1000;
let nextValSeq = 5000;

function nextAttrId(): string {
  nextAttrSeq += 1;
  return `attr-custom-${nextAttrSeq}`;
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

export const useProductAttributesStore = create<ProductAttributesState>()(
  persist(
    (set, get) => ({
      attributes: [],
      seeded: false,

      seedIfEmpty: () => {
        if (!allowMockDataSeeding()) return;
        const { seeded, attributes } = get();
        if (seeded && attributes.length > 0) return;
        set({ attributes: getSeedProductAttributes(), seeded: true });
      },

      listCategories: () => {
        const fromData = new Set(get().attributes.map((a) => a.categoryName));
        for (const c of SEED_PRODUCT_ATTRIBUTE_CATEGORIES) fromData.add(c);
        return Array.from(fromData).sort();
      },

      listForCategory: (categoryName, includeInactive = false) =>
        get()
          .attributes.filter(
            (a) => a.categoryName === categoryName && (includeInactive || a.isActive),
          )
          .sort((a, b) => a.sortOrder - b.sortOrder),

      addAttribute: (categoryName, name) => {
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: "Nama attribute wajib diisi" };
        const exists = get().attributes.some(
          (a) =>
            a.categoryName === categoryName &&
            a.name.toLowerCase() === trimmed.toLowerCase() &&
            a.isActive,
        );
        if (exists) return { ok: false, error: "Attribute sudah ada di kategori ini" };
        const id = nextAttrId();
        const maxOrder = get()
          .attributes.filter((a) => a.categoryName === categoryName)
          .reduce((m, a) => Math.max(m, a.sortOrder), 0);
        set((s) => ({
          attributes: [
            ...s.attributes,
            {
              id,
              categoryName,
              name: trimmed,
              sortOrder: maxOrder + 1,
              isActive: true,
              values: [],
            },
          ],
        }));
        return { ok: true, id };
      },

      updateAttribute: (id, patch) => {
        const attr = get().attributes.find((a) => a.id === id);
        if (!attr) return { ok: false, error: "Attribute tidak ditemukan" };
        if (patch.name?.trim()) {
          const dup = get().attributes.some(
            (a) =>
              a.id !== id &&
              a.categoryName === attr.categoryName &&
              a.name.toLowerCase() === patch.name!.trim().toLowerCase() &&
              a.isActive,
          );
          if (dup) return { ok: false, error: "Nama attribute sudah dipakai" };
        }
        set((s) => ({
          attributes: s.attributes.map((a) =>
            a.id === id
              ? {
                  ...a,
                  ...patch,
                  name: patch.name?.trim() ? patch.name.trim() : a.name,
                }
              : a,
          ),
        }));
        return { ok: true };
      },

      reorderAttribute: (id, direction) => {
        const attr = get().attributes.find((a) => a.id === id);
        if (!attr) return;
        const siblings = get().attributes.filter((a) => a.categoryName === attr.categoryName);
        const reordered = reorderList(siblings, id, direction);
        set((s) => ({
          attributes: s.attributes.map((a) => {
            const updated = reordered.find((r) => r.id === a.id);
            return updated ? { ...a, sortOrder: updated.sortOrder } : a;
          }),
        }));
      },

      addValue: (attributeId, label, abbreviation) => {
        const trimmed = label.trim();
        if (!trimmed) return { ok: false, error: "Nilai attribute wajib diisi" };
        const attr = get().attributes.find((a) => a.id === attributeId);
        if (!attr) return { ok: false, error: "Attribute tidak ditemukan" };
        const abbr = (abbreviation?.trim() || suggestAbbreviation(trimmed)).toUpperCase();
        const id = nextValId();
        const maxOrder = attr.values.reduce((m, v) => Math.max(m, v.sortOrder), 0);
        set((s) => ({
          attributes: s.attributes.map((a) =>
            a.id === attributeId
              ? {
                  ...a,
                  values: [
                    ...a.values,
                    { id, label: trimmed, abbreviation: abbr, sortOrder: maxOrder + 1, isActive: true },
                  ],
                }
              : a,
          ),
        }));
        return { ok: true, id };
      },

      updateValue: (attributeId, valueId, patch) => {
        const attr = get().attributes.find((a) => a.id === attributeId);
        if (!attr) return { ok: false, error: "Attribute tidak ditemukan" };
        set((s) => ({
          attributes: s.attributes.map((a) =>
            a.id === attributeId
              ? {
                  ...a,
                  values: a.values.map((v) =>
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
              : a,
          ),
        }));
        return { ok: true };
      },

      reorderValue: (attributeId, valueId, direction) => {
        set((s) => ({
          attributes: s.attributes.map((a) => {
            if (a.id !== attributeId) return a;
            return { ...a, values: reorderList(a.values, valueId, direction) };
          }),
        }));
      },
    }),
    {
      name: "ses-product-attributes",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (allowMockDataSeeding()) state?.seedIfEmpty();
      },
    },
  ),
);

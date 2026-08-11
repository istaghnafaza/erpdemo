// =============================================================================
// useProductAttributesPage — kelola / baca katalog platform
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useProductAttributesStore } from "@/stores/product-attributes.store";
import { fetchPublishedCatalog } from "@/lib/api/platform-catalog";
import { canEdit } from "@/lib/rbac";

export function useProductAttributesPage(options?: { developerMode?: boolean }) {
  const user = useAuthStore((s) => s.currentUser?.profile ?? null);
  const isPlatformAdmin = useAuthStore((s) => s.currentUser?.isPlatformAdmin ?? false);
  const developerMode = options?.developerMode ?? false;
  const canEditCatalog = developerMode && isPlatformAdmin;
  const canEditAttributes = canEdit(user?.role, "settings");

  const seedIfEmpty = useProductAttributesStore((s) => s.seedIfEmpty);
  const setCatalogReadOnly = useProductAttributesStore((s) => s.setCatalogReadOnly);
  const loadFromPayload = useProductAttributesStore((s) => s.loadFromPayload);
  const catalogReadOnly = useProductAttributesStore((s) => s.catalogReadOnly);
  const catalogCategories = useProductAttributesStore((s) => s.catalogCategories);
  const productTypes = useProductAttributesStore((s) => s.productTypes);
  const typeAttributes = useProductAttributesStore((s) => s.typeAttributes);
  const globalAttributes = useProductAttributesStore((s) => s.globalAttributes);

  const listCategories = useProductAttributesStore((s) => s.listCategories);
  const listCatalogCategories = useProductAttributesStore((s) => s.listCatalogCategories);
  const listGlobalAttributes = useProductAttributesStore((s) => s.listGlobalAttributes);
  const listProductTypesForCategory = useProductAttributesStore((s) => s.listProductTypesForCategory);
  const listAttributesForProductType = useProductAttributesStore((s) => s.listAttributesForProductType);
  const getPayload = useProductAttributesStore((s) => s.getPayload);
  const applySeedFromDeveloper = useProductAttributesStore((s) => s.applySeedFromDeveloper);

  const addCategory = useProductAttributesStore((s) => s.addCategory);
  const updateCategory = useProductAttributesStore((s) => s.updateCategory);
  const reorderCategory = useProductAttributesStore((s) => s.reorderCategory);
  const addGlobalAttribute = useProductAttributesStore((s) => s.addGlobalAttribute);
  const updateGlobalAttribute = useProductAttributesStore((s) => s.updateGlobalAttribute);
  const addProductType = useProductAttributesStore((s) => s.addProductType);
  const updateProductType = useProductAttributesStore((s) => s.updateProductType);
  const reorderProductType = useProductAttributesStore((s) => s.reorderProductType);
  const assignGlobalAttribute = useProductAttributesStore((s) => s.assignGlobalAttribute);
  const removeTypeAttribute = useProductAttributesStore((s) => s.removeTypeAttribute);
  const updateTypeAttribute = useProductAttributesStore((s) => s.updateTypeAttribute);
  const reorderTypeAttribute = useProductAttributesStore((s) => s.reorderTypeAttribute);
  const addTypeAttributeValue = useProductAttributesStore((s) => s.addTypeAttributeValue);
  const updateTypeAttributeValue = useProductAttributesStore((s) => s.updateTypeAttributeValue);
  const reorderTypeAttributeValue = useProductAttributesStore((s) => s.reorderTypeAttributeValue);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedProductTypeId, setSelectedProductTypeId] = useState("");

  useEffect(() => {
    seedIfEmpty();
    setCatalogReadOnly(!canEditCatalog);
  }, [seedIfEmpty, setCatalogReadOnly, canEditCatalog]);

  // Platform developer: load published catalog once then keep editable.
  // Tenant settings: pull newer published version (stays read-only).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetchPublishedCatalog();
        if (cancelled || !r.data) return;
        if (developerMode) {
          loadFromPayload(r.data, { readOnly: false });
          return;
        }
        const currentVersion = useProductAttributesStore.getState().publishedVersion;
        if (r.data.version > currentVersion) {
          loadFromPayload(r.data, { readOnly: true });
        }
      } catch {
        /* fallback: local seed */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-run when mode/user context changes — not when publishedVersion updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount/mode sync
  }, [developerMode, loadFromPayload]);

  // Keep developer mode unlocked even if persist/migrate re-locks.
  useEffect(() => {
    if (canEditCatalog && catalogReadOnly) {
      setCatalogReadOnly(false);
    }
  }, [canEditCatalog, catalogReadOnly, setCatalogReadOnly]);

  const categories = useMemo(
    () => listCategories(true),
    [listCategories, catalogCategories, productTypes],
  );

  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  // If selected category was renamed/removed, keep selection on a valid name.
  useEffect(() => {
    if (!selectedCategory) return;
    if (categories.includes(selectedCategory)) return;
    if (categories.length > 0) setSelectedCategory(categories[0]);
  }, [categories, selectedCategory]);

  const categoryEntities = useMemo(
    () => listCatalogCategories(true) ?? [],
    [listCatalogCategories, catalogCategories],
  );

  const categoryProductTypes = useMemo(
    () => (selectedCategory ? listProductTypesForCategory(selectedCategory, true) : []),
    [selectedCategory, listProductTypesForCategory, productTypes],
  );

  useEffect(() => {
    if (categoryProductTypes.length === 0) {
      setSelectedProductTypeId("");
      return;
    }
    if (!categoryProductTypes.some((pt) => pt.id === selectedProductTypeId)) {
      setSelectedProductTypeId(categoryProductTypes[0].id);
    }
  }, [categoryProductTypes, selectedProductTypeId]);

  const productTypeAttributes = useMemo(
    () =>
      selectedProductTypeId
        ? listAttributesForProductType(selectedProductTypeId, true)
        : [],
    [selectedProductTypeId, listAttributesForProductType, typeAttributes, globalAttributes],
  );

  const availableGlobalAttributes = useMemo(() => {
    const assigned = new Set(productTypeAttributes.map((a) => a.globalAttributeId));
    return listGlobalAttributes(true).filter((g) => g.isActive && !assigned.has(g.id));
  }, [productTypeAttributes, listGlobalAttributes, globalAttributes]);

  const globalAttributesList = useMemo(
    () => listGlobalAttributes(true),
    [listGlobalAttributes, globalAttributes],
  );

  const handleCategoryChange = useCallback((cat: string) => {
    setSelectedCategory(cat);
    setSelectedProductTypeId("");
  }, []);

  const handleLoadFromPayload = useCallback(
    (payload: Parameters<typeof loadFromPayload>[0]) => {
      loadFromPayload(payload, { readOnly: !canEditCatalog });
    },
    [loadFromPayload, canEditCatalog],
  );

  return {
    user,
    isPlatformAdmin,
    canEditCatalog,
    canEditAttributes,
    catalogReadOnly,
    categories,
    categoryEntities,
    selectedCategory,
    setSelectedCategory: handleCategoryChange,
    globalAttributes: globalAttributesList,
    categoryProductTypes,
    selectedProductTypeId,
    setSelectedProductTypeId,
    productTypeAttributes,
    availableGlobalAttributes,
    getPayload,
    applySeedFromDeveloper,
    loadFromPayload: handleLoadFromPayload,
    addCategory,
    updateCategory,
    reorderCategory,
    addGlobalAttribute,
    updateGlobalAttribute,
    addProductType,
    updateProductType,
    reorderProductType,
    assignGlobalAttribute,
    removeTypeAttribute,
    updateTypeAttribute,
    reorderTypeAttribute,
    addTypeAttributeValue,
    updateTypeAttributeValue,
    reorderTypeAttributeValue,
  };
}

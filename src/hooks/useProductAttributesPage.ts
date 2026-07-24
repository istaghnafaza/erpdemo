// =============================================================================
// useProductAttributesPage — kelola attribute produk per kategori (Settings).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useProductAttributesStore } from "@/stores/product-attributes.store";
import { canEdit } from "@/lib/rbac";

export function useProductAttributesPage() {
  const user = useAuthStore((s) => s.currentUser?.profile ?? null);
  const canEditAttributes = canEdit(user?.role, "settings");

  const seedIfEmpty = useProductAttributesStore((s) => s.seedIfEmpty);
  const attributes = useProductAttributesStore((s) => s.attributes);
  const listCategories = useProductAttributesStore((s) => s.listCategories);
  const listForCategory = useProductAttributesStore((s) => s.listForCategory);
  const addAttribute = useProductAttributesStore((s) => s.addAttribute);
  const updateAttribute = useProductAttributesStore((s) => s.updateAttribute);
  const reorderAttribute = useProductAttributesStore((s) => s.reorderAttribute);
  const addValue = useProductAttributesStore((s) => s.addValue);
  const updateValue = useProductAttributesStore((s) => s.updateValue);
  const reorderValue = useProductAttributesStore((s) => s.reorderValue);

  const [selectedCategory, setSelectedCategory] = useState<string>("");

  useEffect(() => {
    seedIfEmpty();
  }, [seedIfEmpty]);

  const categories = useMemo(() => listCategories(), [listCategories, attributes]);

  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const categoryAttributes = useMemo(
    () => (selectedCategory ? listForCategory(selectedCategory, true) : []),
    [selectedCategory, listForCategory, attributes],
  );

  const refreshCategories = useCallback(() => listCategories(), [listCategories, attributes]);

  return {
    user,
    canEditAttributes,
    categories,
    selectedCategory,
    setSelectedCategory,
    categoryAttributes,
    addAttribute,
    updateAttribute,
    reorderAttribute,
    addValue,
    updateValue,
    reorderValue,
    refreshCategories,
    allAttributes: attributes,
  };
}

// =============================================================================
// useStockOpname — 3-step stock opname flow (Fase 8).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { isMockTenantId } from "@/lib/mock-session";
import { useBranchStore } from "@/stores/branch.store";
import { usePosStore } from "@/stores/pos.store";
import { useInventoryStore } from "@/stores/inventory.store";
import { submitOpname } from "@/lib/api/inventory";
import { getBranchProducts, getCategories } from "@/lib/api/products";
import { resolveCategoryForAttributes } from "@/lib/category-attribute-map";
import { getMockPosCatalog, MOCK_CATEGORIES, MOCK_SKU_CATEGORY } from "@/lib/mock-pos-catalog";
import { getNextMockOpnameReference } from "@/lib/mock-inventory";
import { SEED_PRODUCT_ATTRIBUTE_CATEGORIES } from "@/lib/mock-product-attributes";
import { invalidateResponseCache } from "@/lib/api/response-cache";
import { canApprove as rbacCanApprove } from "@/lib/rbac";
import type { OpnameItem } from "@/types/database";

function matchesCategoryScope(productCategory: string, categoryScope: string): boolean {
  if (categoryScope === "all") return true;
  if (productCategory === categoryScope) return true;
  return resolveCategoryForAttributes(productCategory) === categoryScope;
}

export type OpnameStep = 1 | 2 | 3;

export interface OpnameLineItem {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
  systemStock: number;
  physicalStock: number | "";
  purchasePrice: number;
}

function productCategoryName(product: {
  category_id: string | null;
  category?: { name: string } | null;
}): string {
  return product.category?.name ?? "Lainnya";
}

export function useStockOpname() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const mockStockDelta = usePosStore((s) => s.mockStockDelta);
  const mockStockAdjustments = useInventoryStore((s) => s.mockStockAdjustments);
  const applyOpnameAdjustments = useInventoryStore((s) => s.applyOpnameAdjustments);
  const requestOpnameApproval = useInventoryStore((s) => s.requestOpnameApproval);
  const pendingOpnameApproval = useInventoryStore((s) => s.pendingOpnameApproval);

  const user = currentUser?.profile ?? null;
  const tenantId = currentUser?.tenantId ?? "";
  const branchId = activeBranch?.id ?? "";
  const isMockTenant = isMockTenantId(tenantId);
  const role = user?.role ?? "warehouse";
  const canApprove = rbacCanApprove(role, "opname_approve");

  const [step, setStep] = useState<OpnameStep>(1);
  const [categoryScope, setCategoryScope] = useState("all");
  const [lineItems, setLineItems] = useState<OpnameLineItem[]>([]);
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [neonCategories, setNeonCategories] = useState<string[]>([]);

  /** Samakan dengan filter Master Barang: API/mock + kategori seed canonical. */
  const categories = useMemo(() => {
    if (isMockTenant) {
      return Array.from(
        new Set([...MOCK_CATEGORIES, ...SEED_PRODUCT_ATTRIBUTE_CATEGORIES]),
      ).sort();
    }
    return Array.from(
      new Set([...neonCategories, ...SEED_PRODUCT_ATTRIBUTE_CATEGORIES]),
    ).sort();
  }, [isMockTenant, neonCategories]);

  useEffect(() => {
    if (isMockTenant || !tenantId) return;
    void getCategories(tenantId).then((result) => {
      if (result.data) {
        setNeonCategories(result.data.map((c) => c.name).sort());
      }
    });
  }, [isMockTenant, tenantId]);

  const computeSystemStock = useCallback(
    (productId: string, baseStock: number) => {
      if (!isMockTenant) return Math.max(0, baseStock);
      const posDelta = mockStockDelta[productId] ?? 0;
      const invDelta = mockStockAdjustments[`${branchId}:${productId}`] ?? 0;
      return Math.max(0, baseStock + posDelta + invDelta);
    },
    [isMockTenant, mockStockDelta, mockStockAdjustments, branchId],
  );

  const invalidateStockQueries = useCallback(async () => {
    if (!tenantId || !branchId) return;
    invalidateResponseCache(`branch-products:${tenantId}:${branchId}`);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inventory-catalog", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["pos-catalog", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["reports-bundle", tenantId] }),
    ]);
  }, [queryClient, tenantId, branchId]);

  const startSession = useCallback(async () => {
    if (!branchId || !tenantId) return;
    setCatalogLoading(true);
    setSubmitError(null);

    try {
      let items: OpnameLineItem[] = [];

      if (isMockTenant) {
        const catalog = getMockPosCatalog(branchId);
        const scoped = catalog.filter((bp) =>
          matchesCategoryScope(MOCK_SKU_CATEGORY[bp.product.sku] ?? "", categoryScope),
        );

        items = scoped.map((bp) => ({
          productId: bp.product_id,
          sku: bp.product.sku,
          name: bp.product.name,
          unit: bp.product.unit,
          category: MOCK_SKU_CATEGORY[bp.product.sku] ?? "Lainnya",
          systemStock: computeSystemStock(bp.product_id, bp.stock),
          physicalStock: "",
          purchasePrice: bp.product.purchase_price,
        }));
      } else {
        const [catalogResult, categoriesResult] = await Promise.all([
          getBranchProducts(tenantId, branchId),
          getCategories(tenantId),
        ]);

        if (catalogResult.error) {
          setSubmitError(catalogResult.error);
          return;
        }

        const categoryNames = (categoriesResult.data ?? []).map((c) => c.name).sort();
        setNeonCategories(categoryNames);

        const catalog = (catalogResult.data ?? []).filter((bp) => bp.product.is_active);
        const scoped = catalog.filter((bp) =>
          matchesCategoryScope(productCategoryName(bp.product as never), categoryScope),
        );

        items = scoped.map((bp) => ({
          productId: bp.product_id,
          sku: bp.product.sku,
          name: bp.product.name,
          unit: bp.product.unit,
          category: productCategoryName(bp.product as never),
          systemStock: computeSystemStock(bp.product_id, bp.stock),
          physicalStock: "",
          purchasePrice: bp.product.purchase_price,
        }));
      }

      if (items.length === 0) {
        setSubmitError("Tidak ada barang aktif di cabang/kategori ini");
        return;
      }

      setLineItems(items);
      setReference(getNextMockOpnameReference());
      setStep(2);
    } finally {
      setCatalogLoading(false);
    }
  }, [branchId, tenantId, categoryScope, computeSystemStock, isMockTenant]);

  const updatePhysicalStock = useCallback((productId: string, value: number | "") => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, physicalStock: value } : item,
      ),
    );
  }, []);

  const linesWithDiff = useMemo(() => {
    return lineItems.map((item) => {
      const physical = item.physicalStock === "" ? item.systemStock : item.physicalStock;
      const discrepancy = physical - item.systemStock;
      return { ...item, physical, discrepancy };
    });
  }, [lineItems]);

  const summary = useMemo(() => {
    const withDiff = linesWithDiff.filter((l) => l.discrepancy !== 0);
    const shortage = withDiff.filter((l) => l.discrepancy < 0);
    const surplus = withDiff.filter((l) => l.discrepancy > 0);
    const estimatedLoss = shortage.reduce(
      (s, l) => s + Math.abs(l.discrepancy) * l.purchasePrice,
      0,
    );
    return {
      totalItems: lineItems.length,
      itemsWithDiff: withDiff.length,
      shortageCount: shortage.length,
      surplusCount: surplus.length,
      estimatedLoss,
      withDiff,
    };
  }, [linesWithDiff, lineItems.length]);

  const goToReview = useCallback(() => {
    const allFilled = lineItems.every((l) => l.physicalStock !== "");
    if (!allFilled) {
      setSubmitError("Isi stok fisik untuk semua barang sebelum lanjut");
      return;
    }
    setSubmitError(null);
    setStep(3);
  }, [lineItems]);

  const buildOpnameItems = useCallback((): OpnameItem[] => {
    // Semua baris yang dihitung (termasuk selisih 0) → mark verified
    return linesWithDiff.map((l) => ({
      product_id: l.productId,
      sku: l.sku,
      product_name: l.name,
      unit: l.unit,
      system_stock: l.systemStock,
      actual_stock: l.physical,
      discrepancy: l.discrepancy,
      stock_source: "verified" as const,
      notes: null,
    }));
  }, [linesWithDiff]);

  const submitForApproval = useCallback(() => {
    requestOpnameApproval();
    setSubmitError(null);
  }, [requestOpnameApproval]);

  const approveAndAdjust = useCallback(async () => {
    if (!user || !branchId) return { success: false, error: "Sesi tidak valid" };
    setSubmitting(true);
    setSubmitError(null);

    const items = buildOpnameItems();
    const ref = reference || getNextMockOpnameReference();

    if (items.length === 0) {
      setSubmitting(false);
      setSubmitError("Belum ada barang yang dihitung");
      return { success: false, error: "Belum ada barang yang dihitung" };
    }

    if (isMockTenant) {
      applyOpnameAdjustments(branchId, user.id, ref, items);
      await invalidateStockQueries();
      setSubmitting(false);
      setStep(1);
      setLineItems([]);
      return { success: true };
    }

    const result = await submitOpname(tenantId, branchId, user.id, ref, items);
    if (result.error) {
      setSubmitting(false);
      setSubmitError(result.error);
      return { success: false, error: result.error };
    }

    await invalidateStockQueries();
    setSubmitting(false);
    setStep(1);
    setLineItems([]);
    return { success: true };
  }, [
    user,
    branchId,
    buildOpnameItems,
    reference,
    isMockTenant,
    applyOpnameAdjustments,
    tenantId,
    invalidateStockQueries,
  ]);

  const resetFlow = useCallback(() => {
    setStep(1);
    setLineItems([]);
    setReference("");
    setSubmitError(null);
  }, []);

  return {
    user,
    branch: activeBranch,
    role,
    canApprove,
    step,
    setStep,
    categoryScope,
    setCategoryScope,
    categories,
    lineItems: linesWithDiff,
    summary,
    reference,
    submitting,
    catalogLoading,
    submitError,
    pendingOpnameApproval,
    startSession,
    updatePhysicalStock,
    goToReview,
    submitForApproval,
    approveAndAdjust,
    resetFlow,
  };
}

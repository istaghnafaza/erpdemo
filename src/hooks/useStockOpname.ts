// =============================================================================
// useStockOpname — 3-step stock opname flow (Fase 8).
// =============================================================================

import { useCallback, useMemo, useState } from "react";
import { useAuthStore, MOCK_TENANT_ID } from "@/stores/auth.store";
import { isNeonBackend } from "@/lib/api/backend";
import { isMockTenantId } from "@/lib/mock-session";
import { useBranchStore } from "@/stores/branch.store";
import { usePosStore } from "@/stores/pos.store";
import { useInventoryStore } from "@/stores/inventory.store";
import { submitOpname } from "@/lib/api/inventory";
import { getMockPosCatalog, MOCK_CATEGORIES, MOCK_SKU_CATEGORY } from "@/lib/mock-pos-catalog";
import { getNextMockOpnameReference } from "@/lib/mock-inventory";
import { canApprove as rbacCanApprove } from "@/lib/rbac";
import type { OpnameItem } from "@/types/database";

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

export function useStockOpname() {
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
  const [submitError, setSubmitError] = useState<string | null>(null);

  const categories = MOCK_CATEGORIES;

  const computeSystemStock = useCallback(
    (productId: string, baseStock: number) => {
      const posDelta = mockStockDelta[productId] ?? 0;
      const invDelta = mockStockAdjustments[`${branchId}:${productId}`] ?? 0;
      return Math.max(0, baseStock + posDelta + invDelta);
    },
    [mockStockDelta, mockStockAdjustments, branchId],
  );

  const startSession = useCallback(() => {
    if (!branchId) return;
    const catalog = getMockPosCatalog(branchId);
    const scoped =
      categoryScope === "all"
        ? catalog
        : catalog.filter((bp) => (MOCK_SKU_CATEGORY[bp.product.sku] ?? "") === categoryScope);

    const items: OpnameLineItem[] = scoped.map((bp) => ({
      productId: bp.product_id,
      sku: bp.product.sku,
      name: bp.product.name,
      unit: bp.product.unit,
      category: MOCK_SKU_CATEGORY[bp.product.sku] ?? "Lainnya",
      systemStock: computeSystemStock(bp.product_id, bp.stock),
      physicalStock: "",
      purchasePrice: bp.product.purchase_price,
    }));

    setLineItems(items);
    setReference(getNextMockOpnameReference());
    setStep(2);
    setSubmitError(null);
  }, [branchId, categoryScope, computeSystemStock]);

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
    return summary.withDiff.map((l) => ({
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
  }, [summary.withDiff]);

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

    if (isMockTenant) {
      applyOpnameAdjustments(branchId, user.id, ref, items);
      setSubmitting(false);
      setStep(1);
      setLineItems([]);
      return { success: true };
    }

    const result = await submitOpname(tenantId, branchId, user.id, ref, items);
    setSubmitting(false);
    if (result.error) {
      setSubmitError(result.error);
      return { success: false, error: result.error };
    }
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

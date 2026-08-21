// =============================================================================
// useInventoryProducts — business logic for Master Barang (Fase 8).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore, MOCK_TENANT_ID } from "@/stores/auth.store";
import { isMockTenantId } from "@/lib/mock-session";
import { useBranchStore } from "@/stores/branch.store";
import { usePosStore } from "@/stores/pos.store";
import {
  useInventoryStore,
  inventoryStockStatus,
  type StockStatusFilter,
  type MockProductOverride,
} from "@/stores/inventory.store";
import { useProductAttributesStore } from "@/stores/product-attributes.store";
import { fetchPublishedCatalog } from "@/lib/api/platform-catalog";
import {
  getBranchProductsMulti,
  getCategories,
  deactivateProduct,
  updateProduct,
  createProduct,
  upsertBranchProduct,
  createCategory,
} from "@/lib/api/products";
import { queryKeys } from "@/lib/query-keys";
import { getStockMovements } from "@/lib/api/inventory";
import {
  getMockPosCatalog,
  MOCK_CATEGORIES,
  MOCK_SKU_CATEGORY,
  productId,
  generateNextProductSku,
} from "@/lib/mock-pos-catalog";
import { SEED_PRODUCT_ATTRIBUTE_CATEGORIES } from "@/lib/mock-product-attributes";
import { ensureUniqueSku } from "@/lib/product-name-builder";
import { MOCK_BRANCHES } from "@/stores/auth.store";
import { PRODUCTS } from "@/lib/mock-data";
import { canSeePurchasePrice as rbacCanSeePurchasePrice, canEditProducts } from "@/lib/rbac";
import { isOwnerConsolidatedView, resolveScopedBranchIds } from "@/lib/branch-scope";
import {
  downloadImportTemplateCsv,
  downloadImportTemplateExcel,
} from "@/lib/inventory-import-template";
import type { Branch, StockMovement, ProductCategory } from "@/types/database";

const EMPTY_BRANCHES: Branch[] = [];

function toStockQty(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
export interface InventoryProductRow {
  branchProductId: string;
  productId: string;
  branchId: string;
  branchName: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  categoryId: string | null;
  unit: string;
  stockUnit?: string;
  sellUnits?: import("@/lib/product-sell-units").SellUnitInput[];
  stock: number;
  /** Soft-open status: new | unverified | verified */
  verifyStatus: import("@/types/database").DbStockStatus;
  stockOwnership: import("@/types/database").DbStockOwnership;
  reorderPoint: number;
  purchasePrice: number;
  sellingPrice: number;
  warehouseLocation: string;
  isActive: boolean;
  stockStatus: ReturnType<typeof inventoryStockStatus>;
}

export function useInventoryProducts() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const branches = useBranchStore((s) => s.branches);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const mockStockDelta = usePosStore((s) => s.mockStockDelta);
  const mockStockAdjustments = useInventoryStore((s) => s.mockStockAdjustments);
  const mockDeactivatedIds = useInventoryStore((s) => s.mockDeactivatedIds);
  const mockProductOverrides = useInventoryStore((s) => s.mockProductOverrides);
  const mockMovements = useInventoryStore((s) => s.mockMovements);
  const deactivateMockProduct = useInventoryStore((s) => s.deactivateMockProduct);
  const updateMockProduct = useInventoryStore((s) => s.updateMockProduct);
  const addMockProduct = useInventoryStore((s) => s.addMockProduct);
  const globalAttributes = useProductAttributesStore((s) => s.globalAttributes);
  const productTypes = useProductAttributesStore((s) => s.productTypes);
  const typeAttributes = useProductAttributesStore((s) => s.typeAttributes);
  const seedAttributes = useProductAttributesStore((s) => s.seedIfEmpty);

  const productCatalog = useMemo(
    () => ({ globalAttributes, productTypes, typeAttributes }),
    [globalAttributes, productTypes, typeAttributes],
  );

  const user = currentUser?.profile ?? null;
  const tenantId = currentUser?.tenantId ?? "";
  const isMockTenant = isMockTenantId(tenantId);
  const role = user?.role ?? "cashier";
  const canSeePurchasePrice = rbacCanSeePurchasePrice(role);
  const canEditProduct = canEditProducts(role);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [mockLoading, setMockLoading] = useState(true);
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [detailMovements, setDetailMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const branchList =
    branches.length > 0 ? branches : isMockTenant ? MOCK_BRANCHES : EMPTY_BRANCHES;

  const isOwner = role === "owner";
  const consolidated = isOwnerConsolidatedView(isConsolidated, isOwner);

  const effectiveBranchIds = useMemo(() => {
    if (consolidated) {
      if (branchFilter !== "all") {
        const allowed = new Set(branchList.map((b) => b.id));
        return allowed.has(branchFilter) ? [branchFilter] : [];
      }
      return branchList.map((b) => b.id);
    }
    return resolveScopedBranchIds({
      branches: branchList,
      activeBranch,
      isConsolidated: false,
      isOwner,
    });
  }, [consolidated, branchFilter, branchList, activeBranch, isOwner]);

  const computeStock = useCallback(
    (branchId: string, productIdVal: string, baseStock: number) => {
      const posDelta = mockStockDelta[productIdVal] ?? 0;
      const invDelta = mockStockAdjustments[`${branchId}:${productIdVal}`] ?? 0;
      return Math.max(0, baseStock + posDelta + invDelta);
    },
    [mockStockDelta, mockStockAdjustments],
  );

  useEffect(() => {
    seedAttributes();
  }, [seedAttributes]);

  // Pull latest published platform catalog so Master Barang category list matches developer publish.
  useEffect(() => {
    if (isMockTenant) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetchPublishedCatalog();
        if (cancelled || !r.data) return;
        const current = useProductAttributesStore.getState().publishedVersion;
        if (r.data.version !== current) {
          useProductAttributesStore.getState().loadFromPayload(r.data, { readOnly: true });
        }
      } catch {
        /* keep local seed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMockTenant, tenantId]);

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventoryCatalog(tenantId, effectiveBranchIds),
    queryFn: async () => {
      const [catResult, bpResult] = await Promise.all([
        getCategories(tenantId),
        getBranchProductsMulti(tenantId, effectiveBranchIds),
      ]);
      if (catResult.error) throw new Error(catResult.error);
      if (bpResult.error) throw new Error(bpResult.error);
      return {
        categories: catResult.data ?? [],
        byBranch: bpResult.data ?? {},
      };
    },
    enabled: !isMockTenant && Boolean(tenantId) && effectiveBranchIds.length > 0,
  });

  const mockRawRows = useMemo(() => {
    if (!isMockTenant || effectiveBranchIds.length === 0) return [] as InventoryProductRow[];
    const rows: InventoryProductRow[] = [];
    for (const branchId of effectiveBranchIds) {
      const branch = branchList.find((b) => b.id === branchId);
      const catalog = getMockPosCatalog(branchId);
      for (const bp of catalog) {
        const override = mockProductOverrides[bp.product_id];
        if (mockDeactivatedIds[bp.product_id] || override?.isActive === false) continue;

        const stock = computeStock(branchId, bp.product_id, bp.stock);
        const reorderPoint = override?.reorderPoint ?? bp.reorder_point;

        rows.push({
          branchProductId: bp.id,
          productId: bp.product_id,
          branchId,
          branchName: branch?.name ?? "Cabang",
          sku: override?.sku ?? bp.product.sku,
          barcode: override?.barcode ?? bp.product.barcode,
          name: override?.name ?? bp.product.name,
          category: override?.categoryName ?? MOCK_SKU_CATEGORY[bp.product.sku] ?? "Lainnya",
          categoryId: bp.product.category_id,
          unit: override?.unit ?? bp.product.unit,
          stockUnit: override?.stockUnit ?? override?.unit ?? bp.product.unit,
          sellUnits: override?.sellUnits,
          stock,
          verifyStatus: stock > 0 ? ("unverified" as const) : ("new" as const),
          stockOwnership: "owned" as const,
          reorderPoint,
          purchasePrice: override?.purchasePrice ?? bp.product.purchase_price,
          sellingPrice: override?.sellingPrice ?? bp.selling_price,
          warehouseLocation: override?.warehouseLocation ?? bp.warehouse_location ?? "",
          isActive: true,
          stockStatus: inventoryStockStatus(stock, reorderPoint),
        });
      }

      for (const [pid, override] of Object.entries(mockProductOverrides)) {
        if (override.isActive === false) continue;
        if (rows.some((r) => r.productId === pid && r.branchId === branchId)) continue;
        if (!override.sku || !override.name) continue;

        const stock = computeStock(branchId, pid, override.initialStock ?? 0);
        rows.push({
          branchProductId: `new-${branchId}-${pid}`,
          productId: pid,
          branchId,
          branchName: branch?.name ?? "Cabang",
          sku: override.sku,
          barcode: override.barcode ?? null,
          name: override.name,
          category: override.categoryName ?? "Lainnya",
          categoryId: null,
          unit: override.unit ?? "pcs",
          stockUnit: override.stockUnit ?? override.unit ?? "pcs",
          sellUnits: override.sellUnits,
          stock,
          verifyStatus: stock > 0 ? ("unverified" as const) : ("new" as const),
          stockOwnership: "owned" as const,
          reorderPoint: override.reorderPoint ?? 5,
          purchasePrice: override.purchasePrice ?? 0,
          sellingPrice: override.sellingPrice ?? 0,
          warehouseLocation: override.warehouseLocation ?? "",
          isActive: true,
          stockStatus: inventoryStockStatus(stock, override.reorderPoint ?? 5),
        });
      }
    }
    return rows;
  }, [
    isMockTenant,
    effectiveBranchIds,
    branchList,
    mockProductOverrides,
    mockDeactivatedIds,
    computeStock,
  ]);

  useEffect(() => {
    if (!isMockTenant) return;
    const timer = setTimeout(() => setMockLoading(false), 400);
    return () => clearTimeout(timer);
  }, [isMockTenant, effectiveBranchIds]);

  const categories = useMemo((): ProductCategory[] => {
    if (isMockTenant) {
      const mergedCategoryNames = Array.from(
        new Set([...MOCK_CATEGORIES, ...SEED_PRODUCT_ATTRIBUTE_CATEGORIES]),
      ).sort();
      return mergedCategoryNames.map((name, i) => ({
        id: `cat-${i}`,
        tenant_id: MOCK_TENANT_ID,
        name,
        icon: null,
        created_at: new Date().toISOString(),
      }));
    }
    return inventoryQuery.data?.categories ?? [];
  }, [isMockTenant, inventoryQuery.data]);

  const rawRows = useMemo((): InventoryProductRow[] => {
    if (isMockTenant) return mockRawRows;
    const byBranch = inventoryQuery.data?.byBranch ?? {};
    const rows: InventoryProductRow[] = [];
    for (const branchId of effectiveBranchIds) {
      const branch = branchList.find((b) => b.id === branchId);
      for (const bp of byBranch[branchId] ?? []) {
        const cat = (bp.product as { category?: { name: string } }).category?.name ?? "Lainnya";
        if (!bp.product.is_active) continue;
        rows.push({
          branchProductId: bp.id,
          productId: bp.product_id,
          branchId,
          branchName: branch?.name ?? "Cabang",
          sku: bp.product.sku,
          barcode: bp.product.barcode,
          name: bp.product.name,
          category: cat,
          categoryId: bp.product.category_id,
          unit: bp.product.unit,
          stockUnit: bp.product.stock_unit ?? bp.product.unit,
          sellUnits: Array.isArray(bp.product.sell_units)
            ? bp.product.sell_units.map((u) => ({
                id: u.id,
                label: u.label,
                factor_to_base: u.factor_to_base,
                selling_price: u.selling_price,
                purchase_price: u.purchase_price,
                sort_order: u.sort_order,
                is_active: u.is_active,
                allow_fraction: u.allow_fraction,
                preset_qty: u.preset_qty,
              }))
            : [],
          stock: toStockQty(bp.stock),
          verifyStatus: bp.stock_status ?? "verified",
          stockOwnership: bp.stock_ownership ?? "owned",
          reorderPoint: bp.reorder_point,
          purchasePrice: bp.product.purchase_price,
          sellingPrice: bp.selling_price,
          warehouseLocation: bp.warehouse_location ?? "",
          isActive: bp.product.is_active,
          stockStatus: inventoryStockStatus(toStockQty(bp.stock), bp.reorder_point),
        });
      }
    }
    return rows;
  }, [isMockTenant, mockRawRows, inventoryQuery.data, effectiveBranchIds, branchList]);

  const loading = isMockTenant ? mockLoading : inventoryQuery.isPending;
  const inventoryError = isMockTenant ? null : inventoryQuery.error?.message ?? null;

  const invalidateInventory = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.inventoryCatalog(tenantId, effectiveBranchIds),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories(tenantId) });
    void queryClient.invalidateQueries({ queryKey: ["pos-catalog", tenantId] });
  }, [queryClient, tenantId, effectiveBranchIds]);

  const catalogCategories = useProductAttributesStore((s) => s.catalogCategories);

  const catalogCategoryNames = useMemo(
    () =>
      (catalogCategories ?? [])
        .filter((c) => c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => c.name),
    [catalogCategories],
  );

  const categoryNames = useMemo(() => {
    if (isMockTenant) {
      return Array.from(
        new Set([...MOCK_CATEGORIES, ...SEED_PRODUCT_ATTRIBUTE_CATEGORIES, ...catalogCategoryNames]),
      ).sort();
    }
    const fromApi = categories.map((c) => c.name);
    // Prefer published platform catalog names over hardcoded seed so developer publish is visible.
    return Array.from(new Set([...fromApi, ...catalogCategoryNames])).sort();
  }, [categories, isMockTenant, catalogCategoryNames]);

  const existingSkus = useMemo(
    () => rawRows.map((r) => r.sku),
    [rawRows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawRows.filter((row) => {
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (statusFilter !== "all" && row.stockStatus !== statusFilter) return false;
      if (q) {
        const hay = `${row.name} ${row.sku} ${row.barcode ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rawRows, search, categoryFilter, statusFilter]);

  const selectedProduct = useMemo(
    () => rawRows.find((r) => r.productId === selectedProductId) ?? null,
    [rawRows, selectedProductId],
  );

  const branchStockForProduct = useMemo(() => {
    if (!selectedProductId) return [];
    return rawRows.filter((r) => r.productId === selectedProductId);
  }, [rawRows, selectedProductId]);

  const loadMovements = useCallback(
    async (productIdVal: string, branchId: string) => {
      setMovementsLoading(true);
      if (isMockTenant) {
        setDetailMovements(
          mockMovements.filter(
            (m) => m.product_id === productIdVal && m.branch_id === branchId,
          ),
        );
        setMovementsLoading(false);
        return;
      }
      const result = await getStockMovements(tenantId, branchId, {
        productId: productIdVal,
        limit: 50,
      });
      setDetailMovements(result.data ?? []);
      setMovementsLoading(false);
    },
    [isMockTenant, mockMovements, tenantId],
  );

  useEffect(() => {
    if (!selectedProduct) return;
    void loadMovements(selectedProduct.productId, selectedProduct.branchId);
  }, [selectedProduct, loadMovements]);

  const openDetail = useCallback((productIdVal: string) => {
    setSelectedProductId(productIdVal);
  }, []);

  const closeDetail = useCallback(() => setSelectedProductId(null), []);

  const createSkuLock = useRef<string | null>(null);

  const openCreateForm = useCallback(() => {
    setEditingProductId(null);
    setFormOpen(true);
  }, []);

  const openEditForm = useCallback((productIdVal: string) => {
    setEditingProductId(productIdVal);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingProductId(null);
    createSkuLock.current = null;
  }, []);

  const openImportDialog = useCallback(() => setImportOpen(true), []);
  const closeImportDialog = useCallback(() => setImportOpen(false), []);

  const downloadTemplateExcel = useCallback(() => {
    downloadImportTemplateExcel(productCatalog);
  }, [productCatalog]);

  const downloadTemplateCsv = useCallback(() => {
    downloadImportTemplateCsv(productCatalog);
  }, [productCatalog]);

  const handleDeactivate = useCallback(
    async (productIdVal: string) => {
      if (isMockTenant) {
        deactivateMockProduct(productIdVal);
        return { success: true };
      }
      const result = await deactivateProduct(tenantId, productIdVal);
      if (!result.error) invalidateInventory();
      return { success: !result.error, error: result.error ?? undefined };
    },
    [isMockTenant, tenantId, deactivateMockProduct, invalidateInventory],
  );

  const handleSaveProduct = useCallback(
    async (data: MockProductOverride & { sku: string; name: string }) => {
      const branchId = activeBranch?.id ?? branchList[0]?.id;
      if (!branchId) return { success: false, error: "Cabang tidak dipilih" };

      const purchase = data.purchasePrice ?? 0;
      const selling = data.sellingPrice ?? 0;
      if (selling <= purchase) {
        return {
          success: false,
          error: "Harga jual harus lebih besar dari harga beli",
        };
      }

      const uniqueSku = ensureUniqueSku(data.sku, existingSkus);

      if (isMockTenant) {
        if (editingProductId) {
          updateMockProduct(editingProductId, { ...data, sku: uniqueSku });
        } else {
          const newIndex = PRODUCTS.length + Object.keys(mockProductOverrides).length + 1;
          const newId = productId(newIndex);
          addMockProduct(newId, { ...data, sku: uniqueSku });
        }
        return { success: true };
      }

      if (editingProductId) {
        let categoryId: string | null | undefined;
        if (data.categoryName?.trim()) {
          const existing = categories.find((c) => c.name === data.categoryName);
          if (existing) {
            categoryId = existing.id;
          } else {
            const createdCat = await createCategory(tenantId, {
              name: data.categoryName.trim(),
              icon: null,
            });
            categoryId = createdCat.data?.id ?? null;
          }
        }
        await updateProduct(tenantId, editingProductId, {
          sku: uniqueSku,
          barcode: data.barcode ?? null,
          name: data.name,
          unit: data.unit ?? "pcs",
          stock_unit: data.stockUnit ?? data.unit ?? "pcs",
          purchase_price: data.purchasePrice ?? 0,
          sell_units: data.sellUnits ?? [],
          ...(categoryId !== undefined ? { category_id: categoryId } : {}),
        });
        const branchResult = await upsertBranchProduct(tenantId, branchId, editingProductId, {
          selling_price: data.sellingPrice ?? 0,
          reorder_point: data.reorderPoint ?? 5,
          warehouse_location: data.warehouseLocation ?? "",
        });
        if (branchResult.error) {
          return { success: false, error: branchResult.error };
        }
      } else {
        let categoryId: string | null = null;
        if (data.categoryName?.trim()) {
          const existing = categories.find((c) => c.name === data.categoryName);
          if (existing) {
            categoryId = existing.id;
          } else {
            const createdCat = await createCategory(tenantId, {
              name: data.categoryName.trim(),
              icon: null,
            });
            if (createdCat.error || !createdCat.data) {
              return {
                success: false,
                error: createdCat.error ?? "Gagal membuat kategori produk",
              };
            }
            categoryId = createdCat.data.id;
          }
        }
        const initialStock = data.initialStock ?? 0;
        const created = await createProduct(tenantId, {
          sku: uniqueSku,
          barcode: data.barcode ?? null,
          name: data.name,
          category_id: categoryId,
          unit: data.unit ?? "pcs",
          stock_unit: data.stockUnit ?? data.unit ?? "pcs",
          purchase_price: data.purchasePrice ?? 0,
          is_active: true,
          sell_units: data.sellUnits ?? [],
        });
        if (created.error || !created.data) {
          return { success: false, error: created.error ?? "Gagal membuat produk" };
        }
        const branchResult = await upsertBranchProduct(tenantId, branchId, created.data.id, {
          selling_price: data.sellingPrice ?? 0,
          reorder_point: data.reorderPoint ?? 5,
          warehouse_location: data.warehouseLocation ?? "",
          stock: initialStock,
          legacy_stock: 0,
          stock_status: initialStock > 0 ? "unverified" : "new",
          stock_ownership: "owned",
        });
        if (branchResult.error || !branchResult.data) {
          return {
            success: false,
            error:
              branchResult.error ??
              "Produk terbuat tetapi stok cabang gagal disimpan. Edit produk lalu simpan ulang harga/stok.",
          };
        }
      }
      invalidateInventory();
      return { success: true };
    },
    [
      activeBranch,
      branchList,
      isMockTenant,
      editingProductId,
      mockProductOverrides,
      updateMockProduct,
      addMockProduct,
      tenantId,
      categories,
      existingSkus,
      invalidateInventory,
    ],
  );

  const editingDefaults = useMemo(() => {
    if (editingProductId) {
      const row = rawRows.find((r) => r.productId === editingProductId);
      if (!row) return mockProductOverrides[editingProductId] ?? null;
      return {
        sku: row.sku,
        barcode: row.barcode,
        name: row.name,
        categoryName: row.category,
        unit: row.unit,
        stockUnit: row.stockUnit ?? row.unit,
        sellUnits: row.sellUnits,
        purchasePrice: row.purchasePrice,
        sellingPrice: row.sellingPrice,
        reorderPoint: row.reorderPoint,
        warehouseLocation: row.warehouseLocation,
        initialStock: row.stock,
      };
    }
    if (formOpen) {
      if (!createSkuLock.current) {
        const skus = new Set<string>();
        for (const p of PRODUCTS) skus.add(p.sku);
        for (const o of Object.values(mockProductOverrides)) {
          if (o.sku) skus.add(o.sku);
        }
        for (const r of rawRows) skus.add(r.sku);
        createSkuLock.current = generateNextProductSku(skus);
      }
      return { sku: createSkuLock.current };
    }
    return null;
  }, [editingProductId, formOpen, rawRows, mockProductOverrides]);

  return {
    user,
    role,
    tenantId,
    activeBranch,
    productCatalog,
    canSeePurchasePrice,
    canEditProduct,
    isConsolidated,
    branchList,
    loading,
    inventoryError,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    branchFilter,
    setBranchFilter,
    categoryNames,
    filteredRows,
    productCount: rawRows.length,
    selectedProduct,
    branchStockForProduct,
    detailMovements,
    movementsLoading,
    formOpen,
    importOpen,
    editingProductId,
    editingDefaults,
    existingSkus,
    openDetail,
    closeDetail,
    openCreateForm,
    openEditForm,
    closeForm,
    openImportDialog,
    closeImportDialog,
    downloadTemplateExcel,
    downloadTemplateCsv,
    handleDeactivate,
    handleSaveProduct,
    invalidateInventory,
    retryInventory: () => void inventoryQuery.refetch(),
    loadMovements,
  };
}

// =============================================================================
// Neon RPC — Phase 2 (products, customers, inventory, onboarding)
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type { DateRangeFilter } from "@/types/app";
import type {
  BranchProduct,
  BranchProductUpdate,
  BranchProductWithProduct,
  Customer,
  CustomerInsert,
  CustomerUpdate,
  Product,
  ProductCategory,
  ProductCategoryInsert,
  ProductInsert,
  ProductUpdate,
  StockMovement,
  StockMovementInsert,
} from "@/types/database";
import type { OnboardingInventoryItem } from "@/lib/apply-onboarding-inventory";

async function sessionHelpers() {
  const requestSession = await import("@/server/auth/request-session");
  return requestSession;
}

async function requireTenant(tenantId: string) {
  const { assertTenant, requireRequestSession } = await sessionHelpers();
  const session = await requireRequestSession();
  assertTenant(session, tenantId);
  return session;
}

// --- Products ---

export const neonGetCategories = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listCategories } = await import("@/server/services/products");
    return listCategories(data.tenantId);
  });

export const neonCreateCategory = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; payload: Omit<ProductCategoryInsert, "tenant_id"> }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createCategory } = await import("@/server/services/products");
    return createCategory(data.tenantId, data.payload);
  });

export const neonGetProducts = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      options?: { activeOnly?: boolean; categoryId?: string; search?: string };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listProducts } = await import("@/server/services/products");
    return listProducts(data.tenantId, data.options);
  });

export const neonGetProduct = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; productId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getProductById } = await import("@/server/services/products");
    const p = await getProductById(data.tenantId, data.productId);
    if (!p) throw new Error("Produk tidak ditemukan");
    return p;
  });

export const neonGetProductBySku = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; sku: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getProductBySku } = await import("@/server/services/products");
    const p = await getProductBySku(data.tenantId, data.sku);
    if (!p) throw new Error("Produk tidak ditemukan");
    return p;
  });

export const neonGetProductByBarcode = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; barcode: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getProductByBarcode } = await import("@/server/services/products");
    const p = await getProductByBarcode(data.tenantId, data.barcode);
    if (!p) throw new Error("Produk tidak ditemukan");
    return p;
  });

export const neonCreateProduct = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; payload: Omit<ProductInsert, "tenant_id"> }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createProduct } = await import("@/server/services/products");
    return createProduct(data.tenantId, data.payload);
  });

export const neonUpdateProduct = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; productId: string; updates: ProductUpdate }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { updateProduct } = await import("@/server/services/products");
    const p = await updateProduct(data.tenantId, data.productId, data.updates);
    if (!p) throw new Error("Produk tidak ditemukan");
    return p;
  });

export const neonGetBranchProducts = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId: string;
      options?: { search?: string; lowStockOnly?: boolean };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listBranchProducts } = await import("@/server/services/products");
    return listBranchProducts(data.tenantId, data.branchId, data.options);
  });

export const neonGetBranchProductsMulti = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchIds: string[];
      options?: { search?: string; lowStockOnly?: boolean };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listBranchProductsForBranches } = await import("@/server/services/products");
    return listBranchProductsForBranches(data.tenantId, data.branchIds, data.options);
  });

export const neonGetBranchProduct = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string; productId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getBranchProduct } = await import("@/server/services/products");
    const bp = await getBranchProduct(data.tenantId, data.branchId, data.productId);
    if (!bp) throw new Error("Stok cabang tidak ditemukan");
    return bp;
  });

export const neonUpsertBranchProduct = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId: string;
      productId: string;
      payload: Pick<BranchProduct, "selling_price" | "reorder_point" | "warehouse_location"> & {
        stock?: number;
        legacy_stock?: number;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { upsertBranchProduct } = await import("@/server/services/products");
    return upsertBranchProduct(
      data.tenantId,
      data.branchId,
      data.productId,
      data.payload,
    );
  });

export const neonUpdateBranchProduct = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchProductId: string;
      updates: BranchProductUpdate;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { updateBranchProductById } = await import("@/server/services/products");
    const bp = await updateBranchProductById(
      data.tenantId,
      data.branchProductId,
      data.updates,
    );
    if (!bp) throw new Error("Stok cabang tidak ditemukan");
    return bp;
  });

export const neonUpdateSellingPrice = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId: string;
      productId: string;
      sellingPrice: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { updateSellingPrice } = await import("@/server/services/products");
    const bp = await updateSellingPrice(
      data.tenantId,
      data.branchId,
      data.productId,
      data.sellingPrice,
    );
    if (!bp) throw new Error("Stok cabang tidak ditemukan");
    return bp;
  });

export const neonGetLowStockAlert = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId?: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listLowStockAlert } = await import("@/server/services/products");
    return listLowStockAlert(data.tenantId, data.branchId);
  });

// --- Customers ---

export const neonGetCustomers = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      options?: { search?: string; type?: "retail" | "credit" };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listCustomers } = await import("@/server/services/customers");
    return listCustomers(data.tenantId, data.options);
  });

export const neonGetCustomer = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; customerId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getCustomerById } = await import("@/server/services/customers");
    const c = await getCustomerById(data.tenantId, data.customerId);
    if (!c) throw new Error("Pelanggan tidak ditemukan");
    return c;
  });

export const neonCreateCustomer = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; payload: Omit<CustomerInsert, "tenant_id"> }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createCustomer } = await import("@/server/services/customers");
    return createCustomer(data.tenantId, data.payload);
  });

export const neonUpdateCustomer = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; customerId: string; updates: CustomerUpdate }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { updateCustomer } = await import("@/server/services/customers");
    const c = await updateCustomer(data.tenantId, data.customerId, data.updates);
    if (!c) throw new Error("Pelanggan tidak ditemukan");
    return c;
  });

export const neonAdjustOutstandingDebt = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; customerId: string; delta: number }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { adjustOutstandingDebt } = await import("@/server/services/customers");
    const c = await adjustOutstandingDebt(data.tenantId, data.customerId, data.delta);
    if (!c) throw new Error("Pelanggan tidak ditemukan");
    return c;
  });

// --- Inventory (partial) ---

export const neonGetStockMovements = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId: string;
      options?: {
        productId?: string;
        dateRange?: DateRangeFilter;
        type?: StockMovement["type"];
        limit?: number;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listStockMovements } = await import("@/server/services/inventory");
    return listStockMovements(data.tenantId, data.branchId, data.options);
  });

export const neonRecordStockMovement = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      movement: Omit<StockMovementInsert, "tenant_id">;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { insertStockMovement } = await import("@/server/services/inventory");
    return insertStockMovement(data.tenantId, data.movement);
  });

export const neonAdjustStock = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId: string;
      productId: string;
      delta: number;
      type: StockMovement["type"];
      options?: {
        stockSource?: "verified" | "legacy";
        reference?: string;
        notes?: string;
        userId?: string;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { adjustStock } = await import("@/server/services/inventory");
    return adjustStock(
      data.tenantId,
      data.branchId,
      data.productId,
      data.delta,
      data.type,
      data.options,
    );
  });

// --- Onboarding ---

export const neonApplyOnboardingInventory = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId: string;
      items: OnboardingInventoryItem[];
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { applyOnboardingItemsToBranch } = await import(
      "@/server/services/onboarding-inventory"
    );
    return applyOnboardingItemsToBranch(data.tenantId, data.branchId, data.items);
  });

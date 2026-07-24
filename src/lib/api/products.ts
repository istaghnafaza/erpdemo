// =============================================================================
// Products API — master produk + branch_products (stok & harga per cabang)
// =============================================================================

import { db as supabase, ok, fail, queryMany, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import {
  neonCreateCategory,
  neonCreateProduct,
  neonGetBranchProduct,
  neonGetBranchProducts,
  neonGetCategories,
  neonGetLowStockAlert,
  neonGetProduct,
  neonGetProductByBarcode,
  neonGetProductBySku,
  neonGetProducts,
  neonUpdateBranchProduct,
  neonUpdateProduct,
  neonUpdateSellingPrice,
  neonUpsertBranchProduct,
} from "@/lib/api/neon/catalog-fns";
import type { ApiResponse } from "@/types/app";
import type {
  Product, ProductInsert, ProductUpdate,
  ProductCategory, ProductCategoryInsert,
  BranchProduct, BranchProductUpdate, BranchProductWithProduct,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Product Categories
// ---------------------------------------------------------------------------

export async function getCategories(
  tenantId: string
): Promise<ApiResponse<ProductCategory[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonGetCategories({ data: { tenantId } }));
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() =>
    supabase
      .from("product_categories")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name")
  );
}

export async function createCategory(
  tenantId: string,
  payload: Omit<ProductCategoryInsert, "tenant_id">
): Promise<ApiResponse<ProductCategory>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreateCategory({ data: { tenantId, payload } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat kategori");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("product_categories")
      .insert({ ...payload, tenant_id: tenantId })
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Products (master)
// ---------------------------------------------------------------------------

export async function getProducts(
  tenantId: string,
  options?: { activeOnly?: boolean; categoryId?: string; search?: string }
): Promise<ApiResponse<Product[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetProducts({ data: { tenantId, options } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("products")
      .select("*, category:category_id(id, name, icon)")
      .eq("tenant_id", tenantId)
      .order("name");

    if (options?.activeOnly) q = q.eq("is_active", true);
    if (options?.categoryId) q = q.eq("category_id", options.categoryId);
    if (options?.search) q = q.ilike("name", `%${options.search}%`);

    return q;
  });
}

export async function getProduct(
  tenantId: string,
  productId: string
): Promise<ApiResponse<Product>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetProduct({ data: { tenantId, productId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Produk tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*, category:category_id(id, name, icon)")
      .eq("tenant_id", tenantId)
      .eq("id", productId)
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function getProductBySku(
  tenantId: string,
  sku: string
): Promise<ApiResponse<Product>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetProductBySku({ data: { tenantId, sku } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Produk tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("sku", sku)
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function getProductByBarcode(
  tenantId: string,
  barcode: string
): Promise<ApiResponse<Product>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetProductByBarcode({ data: { tenantId, barcode } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Produk tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("barcode", barcode)
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function createProduct(
  tenantId: string,
  payload: Omit<ProductInsert, "tenant_id">
): Promise<ApiResponse<Product>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreateProduct({ data: { tenantId, payload } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat produk");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("products")
      .insert({ ...payload, tenant_id: tenantId })
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function updateProduct(
  tenantId: string,
  productId: string,
  updates: ProductUpdate
): Promise<ApiResponse<Product>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateProduct({ data: { tenantId, productId, updates } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Produk tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("tenant_id", tenantId)
      .eq("id", productId)
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function deactivateProduct(
  tenantId: string,
  productId: string
): Promise<ApiResponse<Product>> {
  return updateProduct(tenantId, productId, { is_active: false });
}


// ---------------------------------------------------------------------------
// BranchProducts (stok & harga per cabang)
// ---------------------------------------------------------------------------

export async function getBranchProducts(
  tenantId: string,
  branchId: string,
  options?: { search?: string; lowStockOnly?: boolean }
): Promise<ApiResponse<BranchProductWithProduct[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetBranchProducts({ data: { tenantId, branchId, options } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("branch_products")
      .select("*, product:product_id(*, category:category_id(id, name))")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId);

    if (options?.search) {
      q = q.or(
        `product.name.ilike.%${options.search}%,product.sku.ilike.%${options.search}%`
      );
    }

    return q;
  });
}

export async function getBranchProduct(
  tenantId: string,
  branchId: string,
  productId: string
): Promise<ApiResponse<BranchProduct>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetBranchProduct({ data: { tenantId, branchId, productId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Stok cabang tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("branch_products")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("product_id", productId)
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function upsertBranchProduct(
  tenantId: string,
  branchId: string,
  productId: string,
  payload: Pick<BranchProduct, "selling_price" | "reorder_point" | "warehouse_location">
): Promise<ApiResponse<BranchProduct>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpsertBranchProduct({
        data: { tenantId, branchId, productId, payload },
      }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal menyimpan stok cabang");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("branch_products")
      .upsert({
        tenant_id: tenantId,
        branch_id: branchId,
        product_id: productId,
        ...payload,
      })
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function updateBranchProduct(
  tenantId: string,
  branchProductId: string,
  updates: BranchProductUpdate
): Promise<ApiResponse<BranchProduct>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateBranchProduct({ data: { tenantId, branchProductId, updates } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Stok cabang tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("branch_products")
      .update(updates)
      .eq("tenant_id", tenantId)
      .eq("id", branchProductId)
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function updateSellingPrice(
  tenantId: string,
  branchId: string,
  productId: string,
  sellingPrice: number
): Promise<ApiResponse<BranchProduct>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateSellingPrice({
        data: { tenantId, branchId, productId, sellingPrice },
      }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Stok cabang tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("branch_products")
      .update({ selling_price: sellingPrice })
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("product_id", productId)
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

/** Returns products at or below reorder_point for a branch */
export async function getLowStockProducts(
  tenantId: string,
  branchId: string
): Promise<ApiResponse<BranchProductWithProduct[]>> {
  return getLowStockAlert(tenantId, branchId);
}

/** Raw SQL version for comparing stock vs reorder_point */
export async function getLowStockAlert(
  tenantId: string,
  branchId?: string
): Promise<ApiResponse<BranchProductWithProduct[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetLowStockAlert({ data: { tenantId, branchId } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("branch_products")
      .select("*, product:product_id(sku, name, unit)")
      .eq("tenant_id", tenantId)
      .filter("stock", "lte", supabase.rpc as never);

    if (branchId) q = q.eq("branch_id", branchId);

    return q.order("stock");
  });
}

import { isNeonBackend, neonCall } from "@/lib/api/backend";
import {
  neonGetPublishedCatalog,
  neonPublishPlatformCatalog,
  neonListCatalogRequests,
  neonResolveCatalogRequest,
  neonSubmitCatalogRequest,
} from "@/lib/api/neon/platform-catalog-fns";
import type { ApiResponse } from "@/types/app";
import type { CatalogRequest, PlatformCatalogPayload } from "@/types/product-attributes";

export async function fetchPublishedCatalog(): Promise<ApiResponse<PlatformCatalogPayload>> {
  if (!isNeonBackend()) {
    return { data: null, error: null };
  }
  const result = await neonCall(() => neonGetPublishedCatalog());
  if (result.error) return { data: null, error: result.error };
  return { data: result.data ?? null, error: null };
}

export async function publishPlatformCatalog(
  payload: PlatformCatalogPayload,
): Promise<ApiResponse<PlatformCatalogPayload>> {
  if (!isNeonBackend()) {
    return { data: payload, error: null };
  }
  const result = await neonCall(() => neonPublishPlatformCatalog({ data: { payload } }));
  if (result.error) return { data: null, error: result.error };
  return { data: result.data ?? null, error: null };
}

export async function submitCatalogRequest(input: {
  tenantId: string;
  tenantName: string;
  kind: CatalogRequest["kind"];
  categoryName?: string;
  productTypeName?: string;
  attributeName?: string;
  proposedLabel: string;
  proposedAbbreviation?: string;
  notes?: string;
}): Promise<ApiResponse<CatalogRequest>> {
  if (!isNeonBackend()) {
    return { data: null, error: null };
  }
  const result = await neonCall(() => neonSubmitCatalogRequest({ data: input }));
  if (result.error) return { data: null, error: result.error };
  return { data: result.data ?? null, error: null };
}

export async function listPlatformCatalogRequests(
  status?: string,
): Promise<ApiResponse<CatalogRequest[]>> {
  if (!isNeonBackend()) {
    return { data: [], error: null };
  }
  const result = await neonCall(() =>
    neonListCatalogRequests({ data: { status: status ?? "pending" } }),
  );
  if (result.error) return { data: null, error: result.error };
  return { data: result.data ?? [], error: null };
}

export async function resolvePlatformCatalogRequest(
  requestId: string,
  status: "approved" | "rejected",
): Promise<ApiResponse<{ ok: boolean }>> {
  if (!isNeonBackend()) {
    return { data: { ok: true }, error: null };
  }
  const result = await neonCall(() => neonResolveCatalogRequest({ data: { requestId, status } }));
  if (result.error) return { data: null, error: result.error };
  return { data: result.data ?? { ok: true }, error: null };
}

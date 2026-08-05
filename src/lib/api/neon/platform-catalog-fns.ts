// =============================================================================
// Platform catalog — Neon server functions
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type { CatalogRequest, PlatformCatalogPayload } from "@/types/product-attributes";

export const neonGetPublishedCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlatformCatalogPayload> => {
    const { requireRequestSession } = await import("@/server/auth/request-session");
    await requireRequestSession();
    const { getOrSeedPublishedCatalog } = await import("@/server/services/platform-catalog");
    return getOrSeedPublishedCatalog();
  },
);

export const neonPublishPlatformCatalog = createServerFn({ method: "POST" })
  .validator((data: { payload: PlatformCatalogPayload }) => data)
  .handler(async ({ data }) => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    const { publishPlatformCatalog } = await import("@/server/services/platform-catalog");
    const session = await requirePlatformAdminSession();
    return publishPlatformCatalog(data.payload, session.sub);
  });

export const neonListCatalogRequests = createServerFn({ method: "GET" })
  .validator((data: { status?: string }) => data)
  .handler(async ({ data }) => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    const { listCatalogRequests } = await import("@/server/services/platform-catalog");
    await requirePlatformAdminSession();
    return listCatalogRequests(data.status);
  });

export const neonSubmitCatalogRequest = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      tenantName: string;
      kind: CatalogRequest["kind"];
      categoryName?: string;
      productTypeName?: string;
      attributeName?: string;
      proposedLabel: string;
      proposedAbbreviation?: string;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { assertTenant, requireRequestSession } = await import("@/server/auth/request-session");
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    const { createCatalogRequest } = await import("@/server/services/platform-catalog");
    return createCatalogRequest(data.tenantId, data.tenantName, {
      kind: data.kind,
      categoryName: data.categoryName,
      productTypeName: data.productTypeName,
      attributeName: data.attributeName,
      proposedLabel: data.proposedLabel,
      proposedAbbreviation: data.proposedAbbreviation,
      notes: data.notes,
    });
  });

export const neonResolveCatalogRequest = createServerFn({ method: "POST" })
  .validator((data: { requestId: string; status: "approved" | "rejected" }) => data)
  .handler(async ({ data }) => {
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    const { resolveCatalogRequest } = await import("@/server/services/platform-catalog");
    const session = await requirePlatformAdminSession();
    await resolveCatalogRequest(data.requestId, data.status, session.sub);
    return { ok: true };
  });

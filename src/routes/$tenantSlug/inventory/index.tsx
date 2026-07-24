import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAuth } from "@/routes/$tenantSlug";

export const Route = createFileRoute("/$tenantSlug/inventory/")({
  beforeLoad: ({ params }) => {
    requireAuth();
    throw redirect({
      to: "/$tenantSlug/inventory/products",
      params: { tenantSlug: params.tenantSlug },
    });
  },
});

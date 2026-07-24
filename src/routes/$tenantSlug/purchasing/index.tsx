import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";

export const Route = createFileRoute("/$tenantSlug/purchasing/")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "warehouse"]);
    throw redirect({
      to: "/$tenantSlug/purchasing/purchase-orders",
      params: { tenantSlug: params.tenantSlug },
    });
  },
});

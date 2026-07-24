import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$tenantSlug/settings/master-data/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$tenantSlug/settings/master-data/product-attributes",
      params: { tenantSlug: params.tenantSlug },
    });
  },
});

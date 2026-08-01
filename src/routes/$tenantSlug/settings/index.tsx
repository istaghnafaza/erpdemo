import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$tenantSlug/settings/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$tenantSlug/settings/pricing",
      params: { tenantSlug: params.tenantSlug },
    });
  },
});

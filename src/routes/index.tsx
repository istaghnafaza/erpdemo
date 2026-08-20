import { createFileRoute, redirect } from "@tanstack/react-router";
import { preparePublicAuthRouteSync, waitForAuthHydration } from "@/lib/auth-bootstrap";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    await waitForAuthHydration();
    const authedRedirect = preparePublicAuthRouteSync();
    if (authedRedirect) throw authedRedirect;

    throw redirect({ to: "/landing" });
  },
});

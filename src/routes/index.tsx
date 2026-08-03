import { createFileRoute, redirect } from "@tanstack/react-router";
import { preparePublicAuthRouteSync } from "@/lib/auth-bootstrap";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const authedRedirect = preparePublicAuthRouteSync();
    if (authedRedirect) throw authedRedirect;

    throw redirect({ to: "/login" });
  },
});

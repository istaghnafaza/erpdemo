import { createFileRoute, redirect } from "@tanstack/react-router";
import { preparePublicAuthRouteSync } from "@/lib/auth-bootstrap";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Sudah login → masuk app / platform
    const authedRedirect = preparePublicAuthRouteSync();
    if (authedRedirect) throw authedRedirect;

    // Funnel iklan / pengunjung baru → landing (bukan login)
    throw redirect({ to: "/landing" });
  },
});

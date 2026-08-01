import { createFileRoute, redirect } from "@tanstack/react-router";
import { preparePublicAuthRoute } from "@/lib/auth-bootstrap";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const authedRedirect = await preparePublicAuthRoute();
    if (authedRedirect) throw authedRedirect;

    throw redirect({ to: "/login" });
  },
});

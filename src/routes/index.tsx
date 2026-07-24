import { createFileRoute, redirect } from "@tanstack/react-router";
import { redirectIfAuthenticated, syncAuthFromServer } from "@/lib/auth-bootstrap";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    await syncAuthFromServer();

    const authedRedirect = redirectIfAuthenticated();
    if (authedRedirect) throw authedRedirect;

    throw redirect({ to: "/login" });
  },
});

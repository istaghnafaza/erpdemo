import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { syncAuthFromServer } from "@/lib/auth-bootstrap";
import { useAuthStore } from "@/stores/auth.store";

export function requirePlatformAdmin(): void {
  const { currentUser, isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated || !currentUser) {
    throw redirect({ to: "/login" });
  }
  if (!currentUser.isPlatformAdmin) {
    throw redirect({ to: "/login" });
  }
}

export const Route = createFileRoute("/platform")({
  beforeLoad: async () => {
    await syncAuthFromServer();
    requirePlatformAdmin();
  },
  component: () => <Outlet />,
});

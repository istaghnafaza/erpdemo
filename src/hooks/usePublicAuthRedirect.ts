import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  resolveAuthenticatedRedirectPath,
  syncAuthFromServer,
} from "@/lib/auth-bootstrap";

/**
 * Client-only: sync sesi ke server lalu redirect jika sudah login.
 * Dipakai di login/register agar beforeLoad tetap sync (SSR hydration aman).
 */
export function usePublicAuthRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await syncAuthFromServer({ force: true });
      if (cancelled) return;
      const dest = resolveAuthenticatedRedirectPath();
      if (dest) navigate({ to: dest, replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);
}

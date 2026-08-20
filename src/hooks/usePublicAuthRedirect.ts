import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  resolveAuthenticatedRedirectHref,
  waitForAuthHydration,
} from "@/lib/auth-bootstrap";

/**
 * Tunggu persist auth, lalu kembalikan ke halaman terakhir (bukan form login).
 */
export function usePublicAuthRedirect() {
  const router = useRouter();
  const [gate, setGate] = useState<"pending" | "guest" | "leaving">("pending");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await waitForAuthHydration();
      if (cancelled) return;
      const href = resolveAuthenticatedRedirectHref();
      if (href) {
        setGate("leaving");
        router.history.replace(href);
        return;
      }
      setGate("guest");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return gate;
}

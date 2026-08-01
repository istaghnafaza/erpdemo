import { useEffect, useState } from "react";
import { checkTenantSlugAvailable } from "@/lib/api/tenants";
import { validateStoreSlug } from "@/lib/onboarding-validation";

export type SlugAvailability = "idle" | "checking" | "available" | "taken" | "invalid";

export function useTenantSlugAvailability(slug: string, tenantId?: string) {
  const [status, setStatus] = useState<SlugAvailability>("idle");

  useEffect(() => {
    const trimmed = slug.trim().toLowerCase();
    const formatErr = validateStoreSlug(trimmed);
    if (!trimmed) {
      setStatus("idle");
      return;
    }
    if (formatErr) {
      setStatus("invalid");
      return;
    }

    setStatus("checking");
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const result = await checkTenantSlugAvailable(trimmed, tenantId);
        if (cancelled) return;
        if (result.error) {
          setStatus("idle");
          return;
        }
        setStatus(result.data ? "available" : "taken");
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, tenantId]);

  const message =
    status === "checking"
      ? "Memeriksa ketersediaan URL..."
      : status === "available"
        ? "URL tersedia"
        : status === "taken"
          ? "URL sudah dipakai — pilih URL lain"
          : status === "invalid"
            ? validateStoreSlug(slug.trim())
            : undefined;

  const isBlocking = status === "taken" || status === "checking";

  return { status, message, isBlocking };
}

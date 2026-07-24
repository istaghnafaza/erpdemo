import { createFileRoute } from "@tanstack/react-router";

/** Liveness probe untuk Railway — tanpa auth/database. */
export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [{ title: "OK — SEPS" }],
  }),
  component: HealthPage,
});

function HealthPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground">
      <p className="text-sm font-medium">SEPS OK</p>
    </div>
  );
}

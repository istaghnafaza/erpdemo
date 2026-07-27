import { createFileRoute } from "@tanstack/react-router";
import { neonHealthCheck } from "@/lib/api/neon/fns";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [{ title: "Health — SEPS" }],
  }),
  loader: () => neonHealthCheck(),
  component: HealthPage,
});

function HealthPage() {
  const data = Route.useLoaderData();

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div className="w-full max-w-lg space-y-3 font-mono text-sm">
        <p className="text-base font-medium font-sans">
          {data.ok ? "SEPS OK" : "SEPS — perlu perbaikan env/DB"}
        </p>
        <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

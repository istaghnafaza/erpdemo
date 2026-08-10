import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/midtrans/notification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const { handleMidtransNotification } = await import(
            "@/server/services/plan-billing"
          );
          const result = await handleMidtransNotification(body);
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[midtrans/notification]", message);
          const status =
            message.includes("Signature") || message.includes("tidak lengkap") ? 403 : 500;
          return Response.json({ ok: false, error: message }, { status });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/plan-billing/bca-inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") ?? "";
          let body = "";
          let subject: string | undefined;
          let secret: string | undefined;

          if (contentType.includes("application/json")) {
            const json = (await request.json()) as Record<string, unknown>;
            body = String(json.body ?? json.text ?? json.content ?? "");
            subject = json.subject != null ? String(json.subject) : undefined;
            secret =
              json.secret != null
                ? String(json.secret)
                : request.headers.get("x-plan-bca-secret") ?? undefined;
          } else {
            body = await request.text();
            secret = request.headers.get("x-plan-bca-secret") ?? undefined;
            subject = request.headers.get("x-email-subject") ?? undefined;
          }

          const { ingestBcaMutasiNotification } = await import(
            "@/server/services/plan-transfer-billing"
          );
          const result = await ingestBcaMutasiNotification({ body, subject, secret });
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[plan-billing/bca-inbound]", message);
          const status = message.includes("secret") ? 403 : 500;
          return Response.json({ ok: false, error: message }, { status });
        }
      },
    },
  },
});

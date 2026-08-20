import { createFileRoute } from "@tanstack/react-router";
import {
  isThermerPrintEntry,
  sampleThermerEntries,
  thermerEntriesAsForceObject,
  type ThermerPrintEntry,
} from "@/lib/thermer-print";
import { createThermerPrintJob, getThermerPrintJob } from "@/server/thermer-print-jobs";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/print/thermer")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("sample") === "1") {
          return jsonResponse(thermerEntriesAsForceObject(sampleThermerEntries()));
        }
        const jobId = url.searchParams.get("job")?.trim();
        if (!jobId) {
          return jsonResponse({ error: "job atau sample=1 diperlukan" }, 400);
        }
        const entries = getThermerPrintJob(jobId);
        if (!entries) {
          return jsonResponse({ error: "Job cetak tidak ditemukan atau kadaluarsa" }, 404);
        }
        return jsonResponse(thermerEntriesAsForceObject(entries));
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const list = Array.isArray(body) ? body : null;
          if (!list || list.length === 0 || !list.every(isThermerPrintEntry)) {
            return jsonResponse({ error: "Body harus array PrintEntry" }, 400);
          }
          const entries = list as ThermerPrintEntry[];
          const id = createThermerPrintJob(entries);
          return jsonResponse({ id });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonResponse({ error: message }, 400);
        }
      },
    },
  },
});

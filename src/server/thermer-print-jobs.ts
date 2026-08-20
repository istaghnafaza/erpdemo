// Short-lived Thermer JSON jobs (Bluetooth Print app fetches without cookies).

import type { ThermerPrintEntry } from "@/lib/thermer-print";

const TTL_MS = 20 * 60 * 1000;
const MAX_JOBS = 200;

type Job = { entries: ThermerPrintEntry[]; expiresAt: number };

const jobs = new Map<string, Job>();

function prune(now: number): void {
  for (const [id, job] of jobs) {
    if (job.expiresAt <= now) jobs.delete(id);
  }
  while (jobs.size > MAX_JOBS) {
    const first = jobs.keys().next().value;
    if (!first) break;
    jobs.delete(first);
  }
}

export function createThermerPrintJob(entries: ThermerPrintEntry[]): string {
  prune(Date.now());
  const id = crypto.randomUUID();
  jobs.set(id, { entries, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function getThermerPrintJob(id: string): ThermerPrintEntry[] | null {
  prune(Date.now());
  const job = jobs.get(id);
  if (!job) return null;
  return job.entries;
}

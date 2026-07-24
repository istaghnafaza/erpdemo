// =============================================================================
// Offline IndexedDB — POS cache & transaction queue (Fase 15).
// =============================================================================

import { createStore, get, set, del, keys } from "idb-keyval";

const cacheStore = createStore("ses-offline-cache", "cache");
const queueStore = createStore("ses-offline-queue-db", "queue");

const KEY = {
  products: (tenantId: string, branchId: string) => `products:${tenantId}:${branchId}`,
  customers: (tenantId: string, branchId: string) => `customers:${tenantId}:${branchId}`,
  activeSession: (branchId: string) => `session:${branchId}`,
  queue: "tx_queue",
  cacheMeta: (tenantId: string, branchId: string) => `meta:${tenantId}:${branchId}`,
} as const;

export interface CacheMeta {
  refreshedAt: string;
  productCount: number;
  customerCount: number;
}

export async function saveProducts<T>(
  tenantId: string,
  branchId: string,
  products: T[],
): Promise<void> {
  await set(KEY.products(tenantId, branchId), products, cacheStore);
}

export async function getProducts<T>(tenantId: string, branchId: string): Promise<T[]> {
  return (await get<T[]>(KEY.products(tenantId, branchId), cacheStore)) ?? [];
}

export async function saveCustomers<T>(
  tenantId: string,
  branchId: string,
  customers: T[],
): Promise<void> {
  await set(KEY.customers(tenantId, branchId), customers, cacheStore);
}

export async function getCustomers<T>(tenantId: string, branchId: string): Promise<T[]> {
  return (await get<T[]>(KEY.customers(tenantId, branchId), cacheStore)) ?? [];
}

export async function saveActiveSession<T>(branchId: string, session: T | null): Promise<void> {
  if (session) await set(KEY.activeSession(branchId), session, cacheStore);
  else await del(KEY.activeSession(branchId), cacheStore);
}

export async function getActiveSession<T>(branchId: string): Promise<T | null> {
  return (await get<T>(KEY.activeSession(branchId), cacheStore)) ?? null;
}

export async function saveCacheMeta(
  tenantId: string,
  branchId: string,
  meta: CacheMeta,
): Promise<void> {
  await set(KEY.cacheMeta(tenantId, branchId), meta, cacheStore);
}

export async function getCacheMeta(
  tenantId: string,
  branchId: string,
): Promise<CacheMeta | null> {
  return (await get<CacheMeta>(KEY.cacheMeta(tenantId, branchId), cacheStore)) ?? null;
}

export async function persistQueue<T>(queue: T[]): Promise<void> {
  await set(KEY.queue, queue, queueStore);
}

export async function loadQueue<T>(): Promise<T[]> {
  return (await get<T[]>(KEY.queue, queueStore)) ?? [];
}

export async function clearCacheNamespace(): Promise<void> {
  const allKeys = await keys(cacheStore);
  await Promise.all(allKeys.map((k) => del(k, cacheStore)));
}

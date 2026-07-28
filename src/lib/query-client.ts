// =============================================================================
// Shared QueryClient — defaults tuned for ERP module navigation (Sprint 1 P0-1).
// =============================================================================

import { QueryClient } from "@tanstack/react-query";

export const QUERY_DEFAULTS = {
  staleTime: 120_000,
  gcTime: 600_000,
  refetchOnWindowFocus: false,
} as const;

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: QUERY_DEFAULTS,
    },
  });
}

let queryClientSingleton: QueryClient | null = null;

export function setQueryClient(client: QueryClient) {
  queryClientSingleton = client;
}

export function getQueryClient(): QueryClient {
  if (!queryClientSingleton) {
    queryClientSingleton = createAppQueryClient();
  }
  return queryClientSingleton;
}

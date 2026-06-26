import { QueryClient } from "@tanstack/react-query";

import { isApiError } from "@/lib/api/api-errors";
import { isFixtureMode } from "@/lib/data-layer/feature-flags";

/**
 * Build a fully-configured QueryClient for the AegisWeb dashboard.
 *
 * Defaults are tuned for an "operator console" workload:
 *   - Realtime widgets stay fresh (15s staleTime) so refetches are cheap.
 *   - Heavy list views stay cached for 60s after the user navigates away.
 *   - Mutations are optimistic where the new state is easy to compute and
 *     pessimistic everywhere else.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The data the operator actually stares at should be re-fetched when
        // it crosses a 15s window. This matches the previous 30s polling
        // interval while giving TanStack Query room to dedupe.
        staleTime: 15_000,
        // Keep cached data on screen for 5 minutes so tab switches feel free.
        gcTime: 5 * 60_000,
        retry: (failureCount: number, error: unknown) => {
          // Don't retry auth errors or 4xx responses, those won't get better.
          if (isApiError(error) && error.status && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attempt: number) => Math.min(1_000 * 2 ** attempt, 8_000),
        // In fixture mode we want a deterministic render from bundled data.
        // Authentication is enforced by the BFF proxy, not JS token storage.
        enabled: () => !isFixtureMode(),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/**
 * Resource-specific staleTime overrides. Keep these centralized so that
 * callers don't sprinkle magic numbers throughout the app.
 */
export const staleTime = {
  realtime: 10_000,
  nearRealtime: 15_000,
  list: 60_000,
  static: 5 * 60_000,
} as const;

/**
 * Resource-specific garbage collection time. We hold the data in cache a bit
 * longer than the staleTime so that the user can navigate back without an
 * extra request being visible.
 */
export const gcTime = {
  default: 5 * 60_000,
  long: 30 * 60_000,
} as const;

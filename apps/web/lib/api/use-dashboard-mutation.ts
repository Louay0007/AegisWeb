"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import { errorMessage, isApiError } from "@/lib/api/api-errors";

type MutationOptions = {
  success: string;
  loading?: string;
  refresh?: Array<() => Promise<void> | void>;
};

/**
 * @deprecated Prefer the typed mutation hooks in `@/lib/data-layer` (e.g.
 * `useCreateAgent`, `useApproveRequest`). They integrate with the React
 * Query cache so invalidations stay in sync.
 *
 * Kept for backwards compatibility with call sites we haven't migrated yet.
 */
export function useDashboardMutation() {
  return useCallback(async (mutation: () => Promise<unknown> | unknown, options: MutationOptions): Promise<void> => {
    const execute = async () => {
      await mutation();
      for (const refresh of options.refresh ?? []) {
        await refresh();
      }
    };

    try {
      await toast.promise(execute(), {
        loading: options.loading ?? "Working...",
        success: options.success,
        error: (error) => formatMutationError(error),
      });
    } catch (error) {
      throw error instanceof Error ? error : new Error("Action failed.");
    }
  }, []);
}

export function formatMutationError(error: unknown) {
  if (isApiError(error)) {
    return error.requestId ? `${error.message} Request ID: ${error.requestId}` : error.message;
  }

  return errorMessage(error);
}

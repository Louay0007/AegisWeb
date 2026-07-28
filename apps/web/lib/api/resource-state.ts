"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError, isApiError } from "@/lib/api/api-errors";
import { useAuthSession } from "@/lib/auth/auth-session";
import { isFixtureFallbackEnabled } from "@/lib/runtime-config";
import { isFixtureMode } from "@/lib/data-layer/feature-flags";

export type ResourceState<T> =
  | {
      status: "loading";
      data?: undefined;
      error?: undefined;
      source?: undefined;
    }
  | { status: "success"; data: T; source: "api" | "fixture"; error?: undefined }
  | { status: "empty"; data: T; source: "api" | "fixture"; error?: undefined }
  | { status: "error"; error: ApiError; fallbackData?: T; source?: undefined };

type UseApiResourceOptions<T> = {
  fallbackData: T;
  enabled?: boolean;
  pollMs?: number;
  isEmpty?: (data: T) => boolean;
};

export function useApiResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  {
    fallbackData,
    enabled = true,
    pollMs,
    isEmpty = defaultIsEmpty,
  }: UseApiResourceOptions<T>,
) {
  const { state: sessionState } = useAuthSession();
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  const isAuthenticated = sessionState.status === "authenticated";
  const canUseApi = enabled && isAuthenticated;
  const fixtureFallbackEnabled = isFixtureFallbackEnabled();
  const shouldUseFixture =
    fixtureFallbackEnabled &&
    (isFixtureMode() ||
      sessionState.status === "demo" ||
      sessionState.status === "unauthenticated");

  // Callers often pass inline async functions. Keep the latest fetcher in a ref so
  // identity churn does not retrigger loads (which caused request storms).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const isEmptyRef = useRef(isEmpty);
  isEmptyRef.current = isEmpty;
  const fallbackDataRef = useRef(fallbackData);
  fallbackDataRef.current = fallbackData;

  const load = useCallback(async () => {
    if (!enabled) {
      setState({ status: "loading" });
      return;
    }

    if (shouldUseFixture) {
      const fallback = fallbackDataRef.current;
      setState(
        isEmptyRef.current(fallback)
          ? { status: "empty", data: fallback, source: "fixture" }
          : { status: "success", data: fallback, source: "fixture" },
      );
      return;
    }

    if (!isAuthenticated) {
      setState({
        status: "error",
        error: new ApiError({
          code: "AUTH_REQUIRED",
          message: "Authentication is required to load this resource.",
        }),
        fallbackData: fallbackDataRef.current,
      });
      return;
    }

    try {
      const data = await fetcherRef.current();
      setState((previous) => {
        const next = isEmptyRef.current(data)
          ? ({ status: "empty", data, source: "api" } as const)
          : ({ status: "success", data, source: "api" } as const);
        if (
          previous.status === next.status &&
          previous.source === next.source &&
          previous.data === next.data
        ) {
          return previous;
        }
        return next;
      });
    } catch (error) {
      setState({
        status: "error",
        error: isApiError(error)
          ? error
          : new ApiError({
              code: "RESOURCE_LOAD_FAILED",
              message:
                error instanceof Error
                  ? error.message
                  : "Could not load resource.",
            }),
        fallbackData: fallbackDataRef.current,
      });
    }
  }, [enabled, isAuthenticated, shouldUseFixture]);

  useEffect(() => {
    void key;
    void load();
  }, [key, load]);

  useEffect(() => {
    if (!pollMs || state.status !== "success" || state.source !== "api") {
      return;
    }

    const interval = window.setInterval(() => void load(), pollMs);
    return () => window.clearInterval(interval);
  }, [load, pollMs, state.source, state.status]);

  return useMemo(() => ({ state, reload: load }), [load, state]);
}

function defaultIsEmpty<T>(data: T) {
  return Array.isArray(data) ? data.length === 0 : !data;
}

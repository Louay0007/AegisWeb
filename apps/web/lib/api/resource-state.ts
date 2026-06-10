"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  const canUseApi = enabled && sessionState.status === "authenticated";
  const fixtureFallbackEnabled = isFixtureFallbackEnabled();
  const shouldUseFixture =
    fixtureFallbackEnabled &&
    (isFixtureMode() ||
      sessionState.status === "demo" ||
      sessionState.status === "unauthenticated");

  const load = useCallback(async () => {
    if (shouldUseFixture) {
      setState(
        isEmpty(fallbackData)
          ? { status: "empty", data: fallbackData, source: "fixture" }
          : { status: "success", data: fallbackData, source: "fixture" },
      );
      return;
    }

    if (!canUseApi) {
      setState({
        status: "error",
        error: new ApiError({
          code: "AUTH_REQUIRED",
          message: "Authentication is required to load this resource.",
        }),
        fallbackData,
      });
      return;
    }

    try {
      const data = await fetcher();
      setState(
        isEmpty(data)
          ? { status: "empty", data, source: "api" }
          : { status: "success", data, source: "api" },
      );
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
        fallbackData,
      });
    }
  }, [
    canUseApi,
    fallbackData,
    fetcher,
    isEmpty,
    shouldUseFixture,
  ]);

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

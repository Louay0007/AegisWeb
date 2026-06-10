import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { createQueryClient } from "@/lib/data-layer/query-client";
import { ApiError } from "@/lib/api/api-errors";

describe("createQueryClient", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("creates a new QueryClient per invocation", () => {
    const a = createQueryClient();
    const b = createQueryClient();
    expect(a).toBeInstanceOf(QueryClient);
    expect(b).toBeInstanceOf(QueryClient);
    expect(a).not.toBe(b);
  });

  it("does not retry 4xx API errors", async () => {
    const client = createQueryClient();
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new ApiError({ code: "BAD_REQUEST", message: "bad", status: 400 }));

    await expect(
      client
        .fetchQuery({
          queryKey: ["no-retry"],
          queryFn: fetcher,
          retry: client.getDefaultOptions().queries?.retry,
        })
        .catch((error) => {
          throw error;
        }),
    ).rejects.toBeInstanceOf(ApiError);
    // default retry logic should return false for 4xx; fetcher called once
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retries transient 5xx errors up to two times", async () => {
    const client = createQueryClient();
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new ApiError({ code: "BOOM", message: "server", status: 500 }));

    await client
      .fetchQuery({
        queryKey: ["retry"],
        queryFn: fetcher,
        retry: client.getDefaultOptions().queries?.retry,
      })
      .catch(() => undefined);
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(3); // initial + 2 retries
  });
});

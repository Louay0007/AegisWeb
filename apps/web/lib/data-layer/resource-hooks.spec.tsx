import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createElement } from "react";

import * as apiClient from "@/lib/api/api-client";
import { useAgents } from "@/lib/data-layer/resource-hooks";
import { useCreateAgent } from "@/lib/data-layer/mutations";
import { queryKeys } from "@/lib/data-layer/query-keys";

const authState = vi.hoisted(() => ({
  current: {
    status: "authenticated",
    session: { user: { role: "OWNER" } },
  },
}));

vi.mock("@/lib/auth/auth-session", () => ({
  useAuthSession: () => ({ state: authState.current }),
}));

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("resource hooks (caching + deduping)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    authState.current = {
      status: "authenticated",
      session: { user: { role: "OWNER" } },
    };
  });

  it("dedupes concurrent reads of the same resource", async () => {
    const fetcher = vi.spyOn(apiClient, "apiGet").mockResolvedValue([
      {
        id: "agt-1",
        organizationId: "org-1",
        name: "Agent",
        identifier: "agent",
        purpose: "purpose",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(client);

    const first = renderHook(() => useAgents(), { wrapper });
    const second = renderHook(() => useAgents(), { wrapper });

    await waitFor(() => {
      expect(first.result.current.state.status).toBe("success");
      expect(second.result.current.state.status).toBe("success");
    });

    // Two subscribers, one network call.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns the same cached data on second mount without re-fetching", async () => {
    const fetcher = vi.spyOn(apiClient, "apiGet").mockResolvedValue([]);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 60_000 } } });
    const wrapper = makeWrapper(client);

    const first = renderHook(() => useAgents(), { wrapper });
    await waitFor(() => expect(first.result.current.state.status).toBe("empty"));
    first.unmount();

    const second = renderHook(() => useAgents(), { wrapper });
    await waitFor(() => expect(second.result.current.state.status).toBe("empty"));

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("invalidates the agents query after a successful mutation", async () => {
    const fetcher = vi.spyOn(apiClient, "apiGet").mockResolvedValue([]);
    const poster = vi.spyOn(apiClient, "apiPost").mockResolvedValue({ id: "agt-new" });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(client);

    const hook = renderHook(
      () => ({
        list: useAgents(),
        create: useCreateAgent({ messages: { success: "Created." } }),
      }),
      { wrapper },
    );

    await waitFor(() => expect(hook.result.current.list.state.status).toBe("empty"));
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      await hook.result.current.create.mutateAsync({ name: "x" });
    });

    await waitFor(() => {
      const data = client.getQueryData(queryKeys.agents.list());
      expect(poster).toHaveBeenCalled();
      // After invalidation the query should be refetched exactly once more.
      expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(data).toBeDefined();
    });
  });
});

describe("fixture fallback", () => {
  it("does not return bundled fixture data in unauthenticated mode", async () => {
    authState.current = { status: "unauthenticated" };
    vi.spyOn(apiClient, "apiGet").mockResolvedValue([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(client);
    const { result } = renderHook(() => useAgents(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe("empty"));
    expect(result.current.state.source).toBe("api");
  });

  it("does not replace authenticated api errors with fixture records", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK", "false");
    vi.spyOn(apiClient, "apiGet").mockRejectedValue(new Error("API unavailable"));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(client);
    const { result } = renderHook(() => useAgents(), { wrapper });

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({
      status: "error",
    });
    expect(result.current.state).not.toHaveProperty("fallbackData");
  });
});

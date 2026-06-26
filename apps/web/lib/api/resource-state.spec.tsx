import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useApiResource } from "@/lib/api/resource-state";

vi.mock("@/lib/auth/auth-session", () => ({
  useAuthSession: () => ({
    state: {
      status: "authenticated",
      session: { user: { role: "OWNER" } },
    },
  }),
}));

describe("legacy resource state", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("surfaces api errors instead of silently showing fallback data", async () => {
    const { result } = renderHook(() =>
      useApiResource(
        "agents",
        async () => {
          throw new Error("API unavailable");
        },
        { fallbackData: [{ id: "fixture-agent" }] },
      ),
    );

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({
      status: "error",
      fallbackData: [{ id: "fixture-agent" }],
    });
  });
});

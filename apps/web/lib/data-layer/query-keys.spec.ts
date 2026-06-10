import { describe, expect, it } from "vitest";

import { queryKeys } from "@/lib/data-layer/query-keys";

describe("queryKeys factory", () => {
  it("builds a stable shape for agent keys", () => {
    expect(queryKeys.agents.all).toEqual(["agents"]);
    expect(queryKeys.agents.list()).toEqual(["agents", "list"]);
    expect(queryKeys.agents.detail("agt-1")).toEqual(["agents", "detail", "agt-1"]);
  });

  it("returns independent tuples for each domain", () => {
    expect(queryKeys.vendors.all).toEqual(["vendors"]);
    expect(queryKeys.vendors.list()).toEqual(["vendors", "list"]);
    expect(queryKeys.vendors.detail("v-1")).toEqual(["vendors", "detail", "v-1"]);
  });

  it("builds audit list keys with a stable default", () => {
    expect(queryKeys.audit.list()).toEqual(["audit", "list", "default"]);
    expect(queryKeys.audit.list("/audit-events?workflowRunId=r-1")).toEqual([
      "audit",
      "list",
      "/audit-events?workflowRunId=r-1",
    ]);
  });

  it("keeps detail keys parameterized by id", () => {
    expect(queryKeys.workflowRuns.audit("run-1")).toEqual(["workflow-runs", "audit", "run-1"]);
    expect(queryKeys.workflowRuns.audit("run-2")).toEqual(["workflow-runs", "audit", "run-2"]);
  });
});

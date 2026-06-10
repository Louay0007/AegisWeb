/**
 * Centralized query key factory. Every `useQuery` and `useMutation` in the
 * app should pull its key from this file. That way invalidations stay in
 * sync with reads without having to grep through components.
 *
 * Conventions:
 *   - "all" -> list of items
 *   - "detail" -> a single item, parameterized by id
 *   - "search" -> list view with a filter
 */
export const queryKeys = {
  agents: {
    all: ["agents"] as const,
    list: () => [...queryKeys.agents.all, "list"] as const,
    detail: (id: string) => [...queryKeys.agents.all, "detail", id] as const,
  },
  vendors: {
    all: ["vendors"] as const,
    list: () => [...queryKeys.vendors.all, "list"] as const,
    detail: (id: string) => [...queryKeys.vendors.all, "detail", id] as const,
  },
  credentials: {
    all: ["credentials"] as const,
    list: () => [...queryKeys.credentials.all, "list"] as const,
    detail: (id: string) => [...queryKeys.credentials.all, "detail", id] as const,
  },
  policies: {
    all: ["policies"] as const,
    list: () => [...queryKeys.policies.all, "list"] as const,
    detail: (id: string) => [...queryKeys.policies.all, "detail", id] as const,
  },
  workflows: {
    all: ["workflows"] as const,
    list: () => [...queryKeys.workflows.all, "list"] as const,
    detail: (id: string) => [...queryKeys.workflows.all, "detail", id] as const,
  },
  workflowRuns: {
    all: ["workflow-runs"] as const,
    list: () => [...queryKeys.workflowRuns.all, "list"] as const,
    detail: (id: string) => [...queryKeys.workflowRuns.all, "detail", id] as const,
    audit: (id: string) => [...queryKeys.workflowRuns.all, "audit", id] as const,
  },
  approvals: {
    all: ["approvals"] as const,
    list: () => [...queryKeys.approvals.all, "list"] as const,
    detail: (id: string) => [...queryKeys.approvals.all, "detail", id] as const,
  },
  receipts: {
    all: ["receipts"] as const,
    list: () => [...queryKeys.receipts.all, "list"] as const,
    detail: (id: string) => [...queryKeys.receipts.all, "detail", id] as const,
  },
  audit: {
    all: ["audit"] as const,
    list: (path?: string) => [...queryKeys.audit.all, "list", path ?? "default"] as const,
  },
  organization: {
    all: ["organization"] as const,
    detail: () => [...queryKeys.organization.all, "detail"] as const,
  },
  users: {
    all: ["users"] as const,
    list: () => [...queryKeys.users.all, "list"] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;

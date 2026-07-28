"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { appNavItems } from "@/components/app-shell/nav-items";
import {
  agents,
  approvals,
  credentials,
  policies,
  receipts,
  vendors,
  workflows,
  workflowRuns,
} from "@/lib/fixtures/dashboard";
import {
  pickItems,
  useAgents,
  useApprovals,
  useCredentials,
  usePolicies,
  useReceipts,
  useVendors,
  useWorkflowRuns,
  useWorkflows,
} from "@/lib/data-layer";

type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  type: string;
};

export function DashboardGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const agentItems = pickItems(useAgents(), agents);
  const vendorItems = pickItems(useVendors(), vendors);
  const credentialItems = pickItems(useCredentials(), credentials);
  const policyItems = pickItems(usePolicies(), policies);
  const workflowItems = pickItems(useWorkflows(), workflows);
  const runItems = pickItems(useWorkflowRuns(), workflowRuns);
  const approvalItems = pickItems(useApprovals(), approvals);
  const receiptItems = pickItems(useReceipts(), receipts);
  const indexedItems: SearchItem[] = useMemo(
    () => [
      ...appNavItems.map((item) => ({
        id: item.href,
        title: item.label,
        subtitle: "Dashboard section",
        href: item.href,
        type: "Page",
      })),
      ...agentItems.map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: item.purpose,
        href: `/app/agents/${item.id}`,
        type: "Agent",
      })),
      ...vendorItems.map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: `${item.website} / ${item.category}`,
        href: `/app/vendors/${item.id}`,
        type: "Vendor",
      })),
      ...credentialItems.map((item) => ({
        id: item.id,
        title: item.label,
        subtitle: `${item.vendor} / ${item.type}`,
        href: `/app/credentials/${item.id}`,
        type: "Credential",
      })),
      ...policyItems.map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: `${item.agent} / ${item.decision}`,
        href: `/app/policies/${item.id}`,
        type: "Policy",
      })),
      ...workflowItems.map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: `${item.template} / ${item.vendor}`,
        href: `/app/workflows/${item.id}`,
        type: "Workflow",
      })),
      ...runItems.map((item) => ({
        id: item.id,
        title: item.workflow,
        subtitle: `${item.status} / ${item.currentStep}`,
        href: `/app/runs/${item.id}`,
        type: "Run",
      })),
      ...approvalItems.map((item) => ({
        id: item.id,
        title: item.action,
        subtitle: `${item.status} / ${item.vendor}`,
        href: `/app/approvals/${item.id}`,
        type: "Approval",
      })),
      ...receiptItems.map((item) => ({
        id: item.id,
        title: item.summary,
        subtitle: `${item.vendor} / ${item.hash}`,
        href: `/app/receipts/${item.id}`,
        type: "Receipt",
      })),
    ],
    [
      agentItems,
      approvalItems,
      credentialItems,
      policyItems,
      receiptItems,
      runItems,
      vendorItems,
      workflowItems,
    ],
  );
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return indexedItems.slice(0, 8);
    return indexedItems
      .filter((item) =>
        `${item.type} ${item.title} ${item.subtitle}`
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 12);
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-10 dark:border-white/25 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Search dashboard"
        >
          <Search className="size-[1.125rem]" strokeWidth={1.75} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Search AegisWeb</DialogTitle>
          <DialogDescription>
            Jump to pages, agents, vendors, policies, runs, approvals, and
            receipts.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.8}
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, status, vendor, or hash"
            className="h-11 pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-[24rem] overflow-y-auto rounded-lg border border-border">
          {results.length ? (
            results.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                href={item.href}
                onClick={() => setOpen(false)}
                className="grid gap-1 border-b border-border px-4 py-3 transition-[background-color] last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                    {item.type}
                    <ArrowUpRight className="size-3" strokeWidth={1.8} />
                  </span>
                </div>
                <span className="truncate text-sm text-muted-foreground">
                  {item.subtitle}
                </span>
              </Link>
            ))
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              No matching dashboard records.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

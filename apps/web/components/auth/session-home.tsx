"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CircleCheck, KeyRound, ReceiptText, ShieldCheck, Workflow } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth/auth-session";

const metrics = [
  { label: "Agents scoped", value: "12", icon: Bot },
  { label: "Approvals waiting", value: "3", icon: ShieldCheck },
  { label: "Credentials exposed", value: "0", icon: KeyRound },
  { label: "Receipts logged", value: "248", icon: ReceiptText },
];

export function SessionHome() {
  const { state } = useAuthSession();
  const session = state.status === "authenticated" || state.status === "demo" ? state.session : null;

  const firstName = useMemo(() => session?.user.name.split(" ")[0] ?? "there", [session]);

  if (!session) {
    return (
      <div className="rounded-lg border border-border bg-background p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Your session is not active</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to open the AegisWeb control gateway.</p>
        <Button asChild className="mt-6">
          <Link href="/login">
            Go to sign in
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={session.mode === "demo" ? "Local demo session" : "Authenticated session"}
        title={`Welcome back, ${firstName}. Your agent authority layer is online.`}
        description="AegisWeb confirms who is acting, which organization owns the action, and whether the gateway should allow, pause, or record it."
        actions={
          <Button className="h-10">
            <Workflow className="size-4" />
            Start workflow
          </Button>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-border bg-background p-5 shadow-xs">
              <metric.icon className="size-5" strokeWidth={1.7} />
              <p className="mt-6 text-3xl font-semibold tracking-normal tabular-nums">{metric.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>

        <aside className="rounded-lg border border-border bg-muted/35 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{session.user.organizationName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{session.user.organizationDomain}</p>
              </div>
              <span className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">{session.user.role}</span>
            </div>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                <span className="text-muted-foreground">User</span>
                <span className="font-medium">{session.user.name}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{session.user.email}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                <span className="text-muted-foreground">Status</span>
                <span className="inline-flex items-center gap-2 font-medium">
                  <CircleCheck className="size-4" />
                  {session.user.status}
                </span>
              </div>
            </div>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-background p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">Active runs</h2>
              <p className="mt-1 text-sm text-muted-foreground">Workflow activity will appear here as the API-backed dashboard comes online.</p>
            </div>
            <Button variant="outline" size="sm">
              View runs
            </Button>
          </div>
          <div className="mt-5 divide-y divide-border rounded-md border border-border">
            {["Invoice download queued", "Renewal check waiting for approval", "Receipt export completed"].map((item, index) => (
              <div key={item} className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm font-medium">{item}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{index === 0 ? "12s" : index === 1 ? "3m" : "18m"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background p-5 shadow-xs">
          <h2 className="text-lg font-semibold tracking-normal">Pending approvals</h2>
          <p className="mt-1 text-sm text-muted-foreground">Human gates for risky agent actions.</p>
          <div className="mt-5 rounded-md bg-foreground p-4 text-background">
            <p className="text-3xl font-semibold tabular-nums">3</p>
            <p className="mt-2 text-sm text-background/75">Requests need a decision before the worker continues.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

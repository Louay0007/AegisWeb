import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <section className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">404</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">This page is outside the control plane.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The route may have moved, or the link may be stale. Return to the dashboard or the public site.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/app/home">Open dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

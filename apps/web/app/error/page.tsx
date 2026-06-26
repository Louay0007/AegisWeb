import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ErrorRoutePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <section className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Error</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Something needs attention.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Retry the action from the dashboard. If the issue repeats, send the current URL and timestamp to support.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/app/home">Open dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="mailto:support@aegisweb.com">Report issue</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

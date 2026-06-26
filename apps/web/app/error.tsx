"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
          <div className="max-w-md border border-border bg-card p-6">
            <h1 className="text-xl font-semibold">AegisWeb could not render this page.</h1>
            <p className="mt-2 text-sm text-muted-foreground">Retry the page. If it happens again, report the issue with the time and route.</p>
            <Button type="button" className="mt-5" onClick={reset}>Retry</Button>
          </div>
        </main>
      </body>
    </html>
  );
}

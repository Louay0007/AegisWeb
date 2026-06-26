"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="border border-destructive/30 bg-destructive/5 p-6 text-destructive">
      <h2 className="text-lg font-semibold">Something broke in this workspace view.</h2>
      <p className="mt-2 text-sm">{error.message || "Refresh the view or report the issue with the request details."}</p>
      <Button type="button" className="mt-4" onClick={reset}>Retry</Button>
    </div>
  );
}

import { CheckCircle, Copy } from "iconoir-react";

import { Button } from "@/components/ui/button";
import { truncateMiddle } from "@/lib/format/formatters";

export function HashIntegrityIndicator({ hash }: { hash: string }) {
  return (
    <div className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-md border border-border bg-muted px-3 text-sm">
      <CheckCircle
        className="size-4 shrink-0 text-emerald-600"
        strokeWidth={1.8}
      />
      <span className="truncate font-mono tabular-nums">
        {truncateMiddle(hash, 24)}
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Copy hash">
        <Copy className="size-3.5" strokeWidth={1.8} />
      </Button>
    </div>
  );
}

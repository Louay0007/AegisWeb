import { DatabaseMonitor } from "iconoir-react";

export function EvidenceSummary({
  title = "Browser evidence",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="aspect-video rounded-md border border-border bg-[linear-gradient(135deg,#f5f5f5,#ffffff)] p-4 shadow-inner">
        <div className="flex h-full flex-col justify-between rounded-sm border border-border bg-background p-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <span className="size-2 rounded-full bg-destructive" />
            <span className="size-2 rounded-full bg-amber-400" />
            <span className="size-2 rounded-full bg-emerald-500" />
          </div>
          <div>
            <DatabaseMonitor className="mb-3 size-5" strokeWidth={1.8} />
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

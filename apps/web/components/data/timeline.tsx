import { CheckCircle, Clock, Circle } from "iconoir-react";

import type { StatusKind } from "@/lib/fixtures/dashboard";
import { cn } from "@/lib/utils";

const iconForStatus: Partial<Record<StatusKind, typeof Circle>> = {
  completed: CheckCircle,
  approved: CheckCircle,
  waiting: Clock,
  running: Clock,
  pending: Circle,
};

export type TimelineItem = {
  title: string;
  description: string;
  time: string;
  status: StatusKind;
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-4">
      {items.map((item, index) => {
        const Icon = iconForStatus[item.status] ?? Circle;
        const last = index === items.length - 1;

        return (
          <li
            key={`${item.title}-${item.time}`}
            className="relative flex gap-3"
          >
            {!last ? (
              <span
                className="absolute left-[15px] top-8 h-[calc(100%+0.5rem)] w-px bg-border"
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-background",
                item.status === "waiting"
                  ? "border-amber-300 text-amber-700"
                  : "border-border text-foreground",
              )}
            >
              <Icon className="size-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-sm font-medium">{item.title}</p>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.time}
                </span>
              </div>
              <p className="mt-1 text-pretty text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

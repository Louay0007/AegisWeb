import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "iconoir-react";

import { cn } from "@/lib/utils";

export type EntityListItem = {
  id: string;
  title: string;
  subtitle: string;
  href?: string;
  meta?: string;
  badge?: ReactNode;
};

export function EntityList({
  items,
  empty = "No records yet.",
}: {
  items: EntityListItem[];
  empty?: string;
}) {
  if (!items.length) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-background">
      {items.map((item) => {
        const content = (
          <div className="flex min-h-16 flex-col items-start justify-between gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 max-w-full">
              <p className="truncate text-sm font-medium leading-5">{item.title}</p>
              <p className="mt-1 truncate text-sm leading-5 text-muted-foreground">
                {item.subtitle}
              </p>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-3 sm:shrink-0">
              {item.badge}
              {item.meta ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.meta}
                </span>
              ) : null}
              {item.href ? (
                <ArrowUpRight
                  className="size-4 text-muted-foreground"
                  strokeWidth={1.8}
                />
              ) : null}
            </div>
          </div>
        );

        return item.href ? (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "block transition-[background-color] hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            {content}
          </Link>
        ) : (
          <div key={item.id}>{content}</div>
        );
      })}
    </div>
  );
}

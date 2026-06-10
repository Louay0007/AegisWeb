import type { ReactNode } from "react";
import { FilterList, Xmark } from "iconoir-react";

import { Button } from "@/components/ui/button";

export function FilterBar({
  children,
  onClear,
}: {
  children: ReactNode;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        {children}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="h-10">
          <FilterList className="size-4" strokeWidth={1.8} />
          Filters
        </Button>
        {onClear ? (
          <Button variant="ghost" className="h-10" onClick={onClear}>
            <Xmark className="size-4" strokeWidth={1.8} />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

import { NavArrowLeft, NavArrowRight } from "iconoir-react";

import { Button } from "@/components/ui/button";

export function PaginationControls({
  page,
  pageCount,
  total,
  onPrevious,
  onNext,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">
        Page <span className="tabular-nums">{page}</span> of{" "}
        <span className="tabular-nums">{pageCount}</span> /{" "}
        <span className="tabular-nums">{total}</span> results
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!onPrevious || page <= 1}
        >
          <NavArrowLeft className="size-4" strokeWidth={1.8} />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!onNext || page >= pageCount}
        >
          Next
          <NavArrowRight className="size-4" strokeWidth={1.8} />
        </Button>
      </div>
    </div>
  );
}

import { NavArrowLeft, NavArrowRight } from "iconoir-react";

import { Button } from "@/components/ui/button";

export function PaginationControls({
  page,
  pageCount,
  total,
  onPrevious,
  onNext,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onPageChange?: (page: number) => void;
}) {
  const pages = visiblePages(page, pageCount);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">
        Page <span className="tabular-nums">{page}</span> of{" "}
        <span className="tabular-nums">{pageCount}</span> /{" "}
        <span className="tabular-nums">{total}</span> results
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!onPrevious || page <= 1}
        >
          <NavArrowLeft className="size-4" strokeWidth={1.8} />
          Previous
        </Button>
        <div className="hidden items-center gap-1 sm:flex" aria-label="Pagination pages">
          {pages.map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground" aria-hidden="true">
                ...
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? "default" : "outline"}
                size="sm"
                className="min-w-9 px-2"
                onClick={() => onPageChange?.(item)}
                disabled={!onPageChange || item === page}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </Button>
            ),
          )}
        </div>
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

function visiblePages(page: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((item) => item >= 1 && item <= pageCount)
    .sort((a, b) => a - b);

  return sorted.flatMap((item, index) => {
    const previous = sorted[index - 1];
    return previous && item - previous > 1 ? ["ellipsis" as const, item] : [item];
  });
}

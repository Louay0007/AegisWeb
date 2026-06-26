import type { ReactNode } from "react";

import { PaginationControls } from "@/components/data/pagination-controls";
import { StatePanel } from "@/components/data/state-panel";
import type { PaginationMeta } from "@/lib/api/pagination";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  mobileCell?: (row: T) => ReactNode;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty = "No records found.",
  loading = false,
  error,
  onRetry,
  onRowAction,
  pagination,
  onPageChange,
  updatedAt,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  empty?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onRowAction?: (row: T) => void;
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  updatedAt?: number;
}) {
  if (loading) {
    return <StatePanel state="loading" title="Loading records" description="AegisWeb is fetching the latest evidence and authority state." />;
  }

  if (error) {
    return <StatePanel state="error" title="Could not load records" description={error} action={onRetry ? { label: "Retry", onClick: onRetry } : undefined} />;
  }

  if (!rows.length) {
    return <StatePanel state="empty" title={empty} description="No matching records are available for the current workspace or filters." />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-muted/70 text-xs uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={cn("px-4 py-3 font-medium", column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={row.id}
                tabIndex={onRowAction ? 0 : undefined}
                onClick={onRowAction ? () => onRowAction(row) : undefined}
                onKeyDown={
                  onRowAction
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowAction(row);
                        }
                      }
                    : undefined
                }
                className={cn("min-h-12 transition-[background-color] hover:bg-muted/50", onRowAction && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-4 py-3 align-middle", column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-border lg:hidden">
        {rows.map((row) => (
          <article key={row.id} className="p-4 sm:p-5">
            {columns[0]?.mobileCell ? (
              columns[0].mobileCell(row)
            ) : (
              <div className="space-y-3">
                {columns.slice(0, 4).map((column) => (
                  <div key={column.key} className="grid gap-1">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{column.header}</span>
                    <div className="min-w-0 text-sm">{column.cell(row)}</div>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
      {pagination ? (
        <div className="border-t border-border">
          {updatedAt ? <DataFreshness updatedAt={updatedAt} /> : null}
          <PaginationControls
            page={pagination.page}
            pageCount={pagination.totalPages}
            total={pagination.total}
            onPrevious={onPageChange ? () => onPageChange(pagination.page - 1) : undefined}
            onNext={onPageChange ? () => onPageChange(pagination.page + 1) : undefined}
            onPageChange={onPageChange}
          />
        </div>
      ) : null}
    </div>
  );
}

function DataFreshness({ updatedAt }: { updatedAt: number }) {
  return (
    <div className="border-b border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
      Last updated {new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </div>
  );
}

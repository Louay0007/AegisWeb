import { Download, Page } from "iconoir-react";

import { Button } from "@/components/ui/button";
import type { EvidenceFileItem } from "@/lib/evidence-types";
import { truncateMiddle } from "@/lib/format/formatters";

export function FileList({
  files,
  onDownload,
}: {
  files: EvidenceFileItem[];
  onDownload?: (
    file: Extract<EvidenceFileItem, object>,
  ) => Promise<void> | void;
}) {
  if (!files.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        No evidence files attached yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-background">
      {files.map((file) => {
        const evidence = normalizeFile(file);
        const canDownload = Boolean(onDownload && evidence.downloadHref);
        return (
          <div
            key={evidence.id}
            className="flex min-h-14 items-center justify-between gap-3 px-4 py-3"
          >
            <span className="flex min-w-0 items-start gap-3">
              <Page
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={1.8}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {evidence.label}
                </span>
                {evidence.kind ||
                evidence.mimeType ||
                evidence.sizeBytes ||
                evidence.sha256 ? (
                  <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {evidence.kind ? <span>{evidence.kind}</span> : null}
                    {evidence.mimeType ? (
                      <span>{evidence.mimeType}</span>
                    ) : null}
                    {typeof evidence.sizeBytes === "number" ? (
                      <span>{formatBytes(evidence.sizeBytes)}</span>
                    ) : null}
                    {evidence.sha256 ? (
                      <span className="font-mono">
                        {truncateMiddle(evidence.sha256, 18)}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Download ${evidence.label}`}
              disabled={!canDownload}
              onClick={() => {
                if (canDownload) void onDownload?.(evidence);
              }}
            >
              <Download className="size-4" strokeWidth={1.8} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function normalizeFile(file: EvidenceFileItem) {
  return typeof file === "string" ? { id: file, label: file } : file;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

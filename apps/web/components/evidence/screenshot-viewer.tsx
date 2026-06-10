"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  DatabaseMonitor,
  Download,
  Expand,
  EyeClosed,
  MediaImageXmark,
  NavArrowLeft,
  NavArrowRight,
  RefreshCircle,
} from "iconoir-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiDownload } from "@/lib/api/api-client";
import {
  isDownloadableImageEvidence,
  screenshotDownloadName,
} from "@/lib/evidence/screenshot-evidence";
import { motionTokens, springs } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

export type ScreenshotEvidence = {
  id: string;
  fileId?: string;
  title: string;
  timestamp: string;
  source: string;
  description?: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
  downloadHref?: string;
};

const defaultScreenshots: ScreenshotEvidence[] = [
  {
    id: "shot-acme-billing",
    title: "Acme billing checkpoint",
    timestamp: "10:42:13",
    source: "billing.acme-analytics.test",
    description:
      "Captured before the guarded plan-change action was submitted.",
  },
];

export function ScreenshotViewer({
  screenshots = defaultScreenshots,
  className,
}: {
  screenshots?: ScreenshotEvidence[];
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<
    "fallback" | "loading" | "ready" | "failed"
  >("fallback");
  const [downloadError, setDownloadError] = useState("");
  const reduce = useReducedMotion();
  const active = screenshots[activeIndex] ?? defaultScreenshots[0];
  const canPage = screenshots.length > 1;
  const canDownload = isDownloadableImageEvidence(active);
  const activeDownloadHref = active.downloadHref;
  const activeMimeType = active.mimeType;
  const activeId = active.id;

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;

    setImageUrl(null);
    setDownloadError("");

    if (!canDownload || !activeDownloadHref) {
      setLoadState("fallback");
      return;
    }

    setLoadState("loading");
    void apiDownload(activeDownloadHref)
      .then((download) => {
        if (disposed) return;
        const blobType = download.blob.type || activeMimeType || "";
        if (!blobType.toLowerCase().startsWith("image/")) {
          setLoadState("failed");
          setDownloadError("Evidence file is not an image.");
          return;
        }
        objectUrl = URL.createObjectURL(download.blob);
        setImageUrl(objectUrl);
        setLoadState("ready");
      })
      .catch((error) => {
        if (disposed) return;
        setLoadState("failed");
        setDownloadError(
          error instanceof Error
            ? error.message
            : "Could not load screenshot evidence.",
        );
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeId, activeDownloadHref, activeMimeType, canDownload]);

  const frame = useMemo(
    () => (
      <EvidenceFrame
        evidence={active}
        large={false}
        imageUrl={imageUrl}
        loadState={loadState}
      />
    ),
    [active, imageUrl, loadState],
  );

  function selectNext(offset: number) {
    setActiveIndex(
      (current) => (current + offset + screenshots.length) % screenshots.length,
    );
  }

  async function downloadActive() {
    if (!active.downloadHref) return;
    setDownloadError("");
    try {
      const download = await apiDownload(active.downloadHref);
      const url = URL.createObjectURL(download.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = download.filename || screenshotDownloadName(active);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Unable to download screenshot evidence.",
      );
    }
  }

  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-border bg-background p-4",
        className,
      )}
      aria-label="Screenshot evidence"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{active.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {active.timestamp} / {active.source}
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Expand className="size-4" strokeWidth={1.8} />
              Open
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>{active.title}</DialogTitle>
              <DialogDescription>
                Sensitive browser evidence from {active.source} at{" "}
                {active.timestamp}.
              </DialogDescription>
            </DialogHeader>
            <EvidenceFrame
              evidence={active}
              large
              imageUrl={imageUrl}
              loadState={loadState}
            />
          </DialogContent>
        </Dialog>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          disabled={!active.downloadHref}
          onClick={() => void downloadActive()}
        >
          <Download className="size-4" strokeWidth={1.8} />
          Download
        </Button>
      </div>

      <motion.div
        key={active.id}
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduce ? { duration: motionTokens.duration.instant } : springs.gentle
        }
      >
        {frame}
      </motion.div>

      {active.description || downloadError ? (
        <p
          className={cn(
            "mt-3 text-pretty text-sm leading-6",
            downloadError ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {downloadError || active.description}
        </p>
      ) : null}

      {canPage ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            aria-label="Previous screenshot"
            onClick={() => selectNext(-1)}
          >
            <NavArrowLeft className="size-4" strokeWidth={1.8} />
          </Button>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {screenshots.map((screenshot, index) => (
              <button
                key={screenshot.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "min-h-10 min-w-28 rounded-md border px-3 py-2 text-left text-xs transition-colors",
                  index === activeIndex
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-muted/30 hover:bg-muted",
                )}
              >
                <span className="block truncate font-medium">
                  {screenshot.title}
                </span>
                <span className="block truncate opacity-70">
                  {screenshot.timestamp}
                </span>
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            aria-label="Next screenshot"
            onClick={() => selectNext(1)}
          >
            <NavArrowRight className="size-4" strokeWidth={1.8} />
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function EvidenceFrame({
  evidence,
  large,
  imageUrl,
  loadState,
}: {
  evidence: ScreenshotEvidence;
  large: boolean;
  imageUrl: string | null;
  loadState: "fallback" | "loading" | "ready" | "failed";
}) {
  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden rounded-md border border-border bg-muted",
        large && "max-h-[68vh]",
      )}
    >
      <div className="absolute inset-x-0 top-0 flex h-9 items-center gap-2 border-b border-border bg-background/90 px-3">
        <span className="size-2 rounded-full bg-destructive/70" />
        <span className="size-2 rounded-full bg-amber-400" />
        <span className="size-2 rounded-full bg-emerald-500" />
        <span className="ml-2 truncate font-mono text-[11px] text-muted-foreground">
          {evidence.source}
        </span>
      </div>
      <div className="flex h-full items-center justify-center px-5 pt-9">
        {loadState === "loading" ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            <RefreshCircle className="size-4 animate-spin" strokeWidth={1.8} />
            Loading evidence image
          </div>
        ) : null}
        {loadState === "ready" && imageUrl ? (
          <img
            src={imageUrl}
            alt={evidence.title}
            className="h-full max-h-full w-full object-contain"
          />
        ) : null}
        {loadState === "failed" ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            <MediaImageXmark className="size-4" strokeWidth={1.8} />
            Screenshot image unavailable
          </div>
        ) : null}
        {loadState === "fallback" ? (
          <div className="w-full max-w-xl rounded-lg border border-border bg-background p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-muted">
                <DatabaseMonitor
                  className="size-5 text-muted-foreground"
                  strokeWidth={1.8}
                />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {evidence.title}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  Masked sensitive fields / Evidence only
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <div className="h-8 rounded border border-border bg-muted/60" />
              <div className="h-8 rounded border border-border bg-muted/40" />
              <div className="h-12 rounded border border-dashed border-border bg-muted/30" />
            </div>
          </div>
        ) : null}
      </div>
      <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-md border border-border bg-background/95 px-2 py-1 text-xs text-muted-foreground">
        <EyeClosed className="size-3.5" strokeWidth={1.8} />
        Sensitive evidence masked
      </div>
    </div>
  );
}

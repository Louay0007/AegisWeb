"use client";

import { useReducedMotion, motion } from "motion/react";
import {
  CheckCircle,
  Clock,
  Pause,
  RefreshCircle,
  WarningCircle,
  XmarkCircle,
} from "iconoir-react";

import { Badge } from "@/components/ui/badge";
import { motionTokens, springs } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

type WorkflowRunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "approved"
  | "rejected"
  | "completed"
  | "failed"
  | "denied"
  | "canceled"
  | "pending"
  | string;

const statusConfig: Record<
  string,
  { label: string; icon: typeof Clock; className: string }
> = {
  queued: {
    label: "Queued",
    icon: Clock,
    className: "border-border bg-muted text-muted-foreground",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "border-border bg-muted text-muted-foreground",
  },
  running: {
    label: "Running",
    icon: RefreshCircle,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  waiting: {
    label: "Waiting",
    icon: Pause,
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  rejected: {
    label: "Rejected",
    icon: XmarkCircle,
    className: "border-destructive/30 bg-destructive/5 text-destructive",
  },
  denied: {
    label: "Denied",
    icon: XmarkCircle,
    className: "border-destructive/30 bg-destructive/5 text-destructive",
  },
  failed: {
    label: "Failed",
    icon: WarningCircle,
    className: "border-destructive/30 bg-destructive/5 text-destructive",
  },
  canceled: {
    label: "Canceled",
    icon: XmarkCircle,
    className: "border-border bg-muted text-muted-foreground",
  },
};

export function WorkflowRunStatusBadge({
  status,
  size = "default",
  live = false,
  className,
}: {
  status: WorkflowRunStatus;
  size?: "compact" | "default";
  live?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const config = statusConfig[status] ?? {
    label: "Unknown",
    icon: WarningCircle,
    className: "border-border bg-muted text-muted-foreground",
  };
  const Icon = config.icon;
  const isRunning = status === "running";

  return (
    <Badge
      variant="outline"
      aria-live={live ? "polite" : undefined}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-md border px-2 font-medium",
        size === "compact" ? "h-7 text-[11px]" : "h-8 text-xs",
        config.className,
        className,
      )}
    >
      {isRunning && !reduce ? (
        <motion.span
          aria-hidden="true"
          animate={{ rotate: 360 }}
          transition={{
            duration: motionTokens.duration.slow,
            ease: "linear",
            repeat: Infinity,
          }}
          className="inline-flex"
        >
          <Icon className="size-3.5" strokeWidth={1.8} />
        </motion.span>
      ) : (
        <Icon className="size-3.5" strokeWidth={1.8} />
      )}
      {isRunning && !reduce ? (
        <motion.span
          initial={{ opacity: 1, scale: 1 }}
          animate={{
            opacity: [1, 0.65, 1],
            scale: [1, motionTokens.scale.subtle, 1],
          }}
          transition={{
            ...springs.snappy,
            repeat: Infinity,
            repeatDelay: motionTokens.duration.normal,
          }}
        >
          {config.label}
        </motion.span>
      ) : (
        config.label
      )}
    </Badge>
  );
}

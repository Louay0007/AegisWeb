import {
  CheckCircle,
  Circle,
  Clock,
  Pause,
  Play,
  WarningTriangle,
  XmarkCircle,
} from "iconoir-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatusKind } from "@/lib/fixtures/dashboard";

const statusMap: Record<
  StatusKind,
  { label: string; icon: typeof Circle; className: string }
> = {
  active: {
    label: "Active",
    icon: CheckCircle,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  paused: {
    label: "Paused",
    icon: Pause,
    className: "border-neutral-300 bg-muted text-muted-foreground",
  },
  revoked: {
    label: "Revoked",
    icon: XmarkCircle,
    className: "border-destructive/30 bg-destructive/5 text-destructive",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  running: {
    label: "Running",
    icon: Play,
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  waiting: {
    label: "Waiting",
    icon: WarningTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  rejected: {
    label: "Rejected",
    icon: XmarkCircle,
    className: "border-destructive/30 bg-destructive/5 text-destructive",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  failed: {
    label: "Failed",
    icon: XmarkCircle,
    className: "border-destructive/30 bg-destructive/5 text-destructive",
  },
};

export function StatusBadge({
  status,
  compact = false,
}: {
  status: StatusKind;
  compact?: boolean;
}) {
  const item = statusMap[status] ?? {
    label: "Unknown",
    icon: Circle,
    className: "border-border bg-muted text-muted-foreground",
  };
  const Icon = item.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 whitespace-nowrap rounded-md font-medium",
        item.className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={1.8} />
      {compact ? item.label.slice(0, 3) : item.label}
    </Badge>
  );
}

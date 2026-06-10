import {
  CheckCircle,
  ClipboardCheck,
  ShieldAlert,
  XmarkCircle,
} from "iconoir-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PolicyDecision } from "@/lib/fixtures/dashboard";

const decisionMap: Record<
  PolicyDecision,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  allow: {
    label: "Allowed",
    icon: CheckCircle,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  approval_required: {
    label: "Approval required",
    icon: ShieldAlert,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  deny: {
    label: "Denied",
    icon: XmarkCircle,
    className: "border-destructive/30 bg-destructive/5 text-destructive",
  },
  record_only: {
    label: "Recorded",
    icon: ClipboardCheck,
    className: "border-border bg-muted text-foreground",
  },
};

export function PolicyDecisionBadge({
  decision,
}: {
  decision: PolicyDecision;
}) {
  const item = decisionMap[decision];
  const Icon = item.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-md font-medium", item.className)}
    >
      <Icon className="size-3.5" strokeWidth={1.8} />
      {item.label}
    </Badge>
  );
}

import {
  CheckCircle,
  FireFlame,
  WarningCircle,
  WarningTriangle,
} from "iconoir-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/fixtures/dashboard";

const riskMap: Record<
  RiskLevel,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  low: {
    label: "Low risk",
    icon: CheckCircle,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  medium: {
    label: "Medium risk",
    icon: WarningCircle,
    className: "border-neutral-300 bg-muted text-foreground",
  },
  high: {
    label: "High risk",
    icon: WarningTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  critical: {
    label: "Critical risk",
    icon: FireFlame,
    className: "border-destructive/30 bg-destructive/5 text-destructive",
  },
};

export function RiskLevelBadge({ risk }: { risk: RiskLevel }) {
  const item = riskMap[risk];
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

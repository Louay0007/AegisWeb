import type { ComponentType, SVGProps } from "react";

type DashboardIcon = ComponentType<SVGProps<SVGSVGElement>>;

import { cn } from "@/lib/utils";

const toneClass = {
  neutral: "bg-foreground text-background",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-white",
  running: "bg-cyan-600 text-white",
};

export function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  icon: DashboardIcon;
  tone?: keyof typeof toneClass;
}) {
  return (
    <article className="rounded-lg border border-border bg-background p-4 shadow-xs sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal tabular-nums sm:mt-3 sm:text-3xl">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-md",
            toneClass[tone],
          )}
        >
          <Icon className="size-4" strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-3 text-pretty text-sm text-muted-foreground sm:mt-4">{detail}</p>
    </article>
  );
}

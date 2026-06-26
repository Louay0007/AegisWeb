import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { Box, RefreshCircle, WarningTriangle } from "iconoir-react";

type DashboardIcon = ComponentType<SVGProps<SVGSVGElement>>;

import { Button } from "@/components/ui/button";

export function StatePanel({
  state,
  title,
  description,
  action,
  icon: Icon,
}: {
  state: "loading" | "empty" | "error";
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  icon?: DashboardIcon;
}) {
  const FallbackIcon =
    state === "loading"
      ? RefreshCircle
      : state === "error"
        ? WarningTriangle
        : Box;
  const DisplayIcon = Icon ?? FallbackIcon;

  return (
    <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
      <span className="mx-auto inline-flex size-10 items-center justify-center rounded-md border border-border bg-muted">
        <DisplayIcon
          className={
            state === "loading"
              ? "size-5 animate-spin text-muted-foreground"
              : "size-5 text-muted-foreground"
          }
          strokeWidth={1.8}
        />
      </span>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? (
        <Button className="mt-5 h-10" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
      {state === "empty" ? (
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <Link href="/app/getting-started" className="font-medium text-foreground underline-offset-4 hover:underline">Open quick start</Link>
          <Link href="/app/help" className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Read help</Link>
        </div>
      ) : null}
    </div>
  );
}

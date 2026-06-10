"use client";

import { motion, useReducedMotion } from "motion/react";
import { CheckCircle, Clock, Hashtag, User } from "iconoir-react";

import { WorkflowRunStatusBadge } from "@/components/display/workflow-run-status-badge";
import { motionTokens, springs } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

export type ReceiptTimelineEvent = {
  time: string;
  actor: string;
  status: string;
  summary: string;
  hash?: string;
};

export type ReceiptTimelinePhase = {
  title: string;
  events: ReceiptTimelineEvent[];
};

export function ReceiptTimeline({
  phases,
  className,
}: {
  phases: ReceiptTimelinePhase[];
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <div className={cn("space-y-4", className)}>
      {phases.map((phase, phaseIndex) => (
        <motion.section
          key={phase.title}
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduce
              ? { duration: motionTokens.duration.instant }
              : {
                  ...springs.gentle,
                  delay: phaseIndex * motionTokens.duration.instant,
                }
          }
          className="rounded-lg border border-border bg-muted/20 p-4"
        >
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle
              className="size-4 text-muted-foreground"
              strokeWidth={1.8}
            />
            <h3 className="text-sm font-semibold">{phase.title}</h3>
          </div>
          <div className="space-y-3">
            {phase.events.map((event, eventIndex) => (
              <article
                key={`${phase.title}-${event.hash ?? event.summary}-${event.time}-${eventIndex}`}
                className="grid gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-[6rem_minmax(0,1fr)_auto]"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  <Clock className="size-3.5" strokeWidth={1.8} />
                  {event.time}
                </div>
                <div className="min-w-0">
                  <p className="text-pretty text-sm leading-6">
                    {event.summary}
                  </p>
                  <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="size-3.5 shrink-0" strokeWidth={1.8} />
                    <span className="truncate">{event.actor}</span>
                  </p>
                  {event.hash ? (
                    <p className="mt-2 flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                      <Hashtag
                        className="size-3.5 shrink-0"
                        strokeWidth={1.8}
                      />
                      <span className="truncate">{event.hash}</span>
                    </p>
                  ) : null}
                </div>
                <WorkflowRunStatusBadge status={event.status} size="compact" />
              </article>
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  );
}

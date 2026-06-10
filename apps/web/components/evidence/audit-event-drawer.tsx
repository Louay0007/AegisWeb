"use client";

import { useState } from "react";
import Link from "next/link";
import { Code, Copy, Hashtag, ShieldCheck } from "iconoir-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { relatedAuditLinks } from "@/lib/audit/audit-links";
import { type AuditEventFixture } from "@/lib/fixtures/dashboard";
import { redactSecretPayload, truncateMiddle } from "@/lib/format/formatters";

export function AuditEventDrawer({
  event,
  trigger,
}: {
  event: AuditEventFixture;
  trigger?: React.ReactNode;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const redacted = redactSecretPayload(event.payload);
  const links = relatedAuditLinks(event);

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            Inspect
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="break-words">{event.eventType}</SheetTitle>
          <SheetDescription>{event.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <section className="rounded-lg border border-border bg-background p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck
                className="size-4 text-muted-foreground"
                strokeWidth={1.8}
              />
              <h3 className="text-sm font-semibold">Event metadata</h3>
            </div>
            <dl className="grid gap-3">
              <Meta label="Event ID" value={event.id} />
              <Meta label="Timestamp" value={event.timestamp} />
              <Meta label="Actor" value={event.actor} />
              <Meta label="Run" value={event.workflowRun} />
              <Meta label="Hash" value={event.hash} mono />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyValue("event", event.id)}
              >
                <Copy className="size-4" strokeWidth={1.8} />
                {copied === "event" ? "Copied ID" : "Copy ID"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyValue("hash", event.hash)}
              >
                <Hashtag className="size-4" strokeWidth={1.8} />
                {copied === "hash"
                  ? "Copied hash"
                  : truncateMiddle(event.hash, 18)}
              </Button>
            </div>
            {links.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {links.map((link) => (
                  <Button key={link.href} asChild variant="outline" size="sm">
                    <Link href={link.href}>{link.label}</Link>
                  </Button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-border bg-background p-4">
            <div className="mb-3 flex items-center gap-2">
              <Code
                className="size-4 text-muted-foreground"
                strokeWidth={1.8}
              />
              <h3 className="text-sm font-semibold">Redacted payload</h3>
            </div>
            <pre className="max-h-[26rem] overflow-auto rounded-md border border-border bg-muted/40 p-4 text-xs leading-6">
              {JSON.stringify(redacted, null, 2)}
            </pre>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Meta({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "break-all font-mono text-xs"
            : "break-words text-sm font-medium"
        }
      >
        {value}
      </dd>
    </div>
  );
}

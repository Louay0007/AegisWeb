import {
  BadgeCheck,
  Check,
  Clock3,
  Download,
  FileCheck2,
  Fingerprint,
  KeyRound,
  PauseCircle,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { AnimatedSection, MotionSurface, SectionReveal } from "@/components/section-reveal";

const receiptMeta = [
  ["Receipt ID", "RCP-2025-0522-10-03-21"],
  ["Workflow", "SaaS renewal review"],
  ["Agent", "procurement-bot@company.com"],
  ["Vendor", "Acme Billing"],
];

const decisions = [
  {
    icon: Download,
    label: "Invoice downloaded",
    value: "INV-2047.pdf",
  },
  {
    icon: PauseCircle,
    label: "Policy decision",
    value: "Approval required",
  },
  {
    icon: UserCheck,
    label: "Approver",
    value: "Finance Manager",
  },
  {
    icon: KeyRound,
    label: "Credential",
    value: "Injected, never exposed",
  },
];

const timeline = [
  ["10:15:42", "Controlled browser session opened"],
  ["10:15:57", "Credential injected into vendor portal"],
  ["10:16:20", "Billing page reached and captured"],
  ["10:17:11", "Invoice downloaded with hash record"],
  ["10:18:04", "Renewal increase detected"],
  ["10:19:33", "Approval granted and receipt sealed"],
];

export function ProofSection() {
  return (
    <AnimatedSection id="proof" className="bg-foreground px-6 py-20 text-background md:px-12 md:py-28 lg:px-20 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 border-b border-background/20 pb-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="mb-4 text-xs uppercase tracking-widest text-background/50">
              Proof
            </p>
            <h2 className="max-w-3xl text-4xl font-medium tracking-tight text-background md:text-5xl lg:text-7xl">
              Every action leaves a receipt.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-background/65 md:justify-self-end md:text-lg">
            AegisWeb records the agent identity, policy decision, credential handling, approval record, screenshots, timestamps, and final outcome for every sensitive web action.
          </p>
        </div>

        <div className="grid border-b border-background/20 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="border-background/20 py-8 lg:border-r lg:pr-8">
            <MotionSurface className="border border-background/20 bg-background text-foreground">
              <div className="flex flex-col gap-6 border-b border-border p-6 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 border border-border px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
                    <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Audit receipt
                  </div>
                  <h3 className="max-w-xl text-2xl font-medium tracking-tight md:text-3xl">
                    Renewal increase found. Downgrade proposal approved.
                  </h3>
                </div>
                <div className="flex min-w-40 items-center gap-3 border border-border px-4 py-3">
                  <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">Verified</p>
                    <p className="text-xs text-muted-foreground">SHA-256 sealed</p>
                  </div>
                </div>
              </div>

              <div className="grid border-b border-border md:grid-cols-4">
                {receiptMeta.map(([label, value]) => (
                  <div key={label} className="border-b border-r border-border p-4 last:border-r-0 md:border-b-0">
                    <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                      {label}
                    </p>
                    <p className="break-words text-sm font-medium leading-snug">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-0 md:grid-cols-2">
                {decisions.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.label} className="flex min-h-32 gap-4 border-b border-r border-border p-5 even:border-r-0">
                      <div className="flex h-10 w-10 flex-none items-center justify-center border border-border">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid md:grid-cols-[0.9fr_1.1fr]">
                <div className="border-b border-border p-6 md:border-b-0 md:border-r">
                  <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
                    Evidence
                  </p>
                  <div className="grid gap-3">
                    <SectionReveal delay="short">
                      <EvidenceFrame label="Vendor billing page" />
                    </SectionReveal>
                    <SectionReveal delay="medium">
                      <EvidenceFrame label="Invoice download state" />
                    </SectionReveal>
                  </div>
                </div>

                <div className="p-6">
                  <p className="mb-5 text-xs uppercase tracking-widest text-muted-foreground">
                    Event timeline
                  </p>
                  <ol className="space-y-4">
                    {timeline.map(([time, event], index) => (
                      <li key={event} className="grid grid-cols-[5.5rem_1fr] gap-4 text-sm">
                        <time className="font-mono text-xs text-muted-foreground">{time}</time>
                        <div className="relative border-l border-border pl-4">
                          <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 bg-foreground" />
                          <p className="leading-relaxed">{event}</p>
                          {index === timeline.length - 1 ? (
                            <div className="mt-3 inline-flex items-center gap-2 border border-border px-3 py-1 text-xs text-muted-foreground">
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              Approved and logged
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </MotionSurface>
          </div>

          <aside className="content-start border-background/20 py-8 lg:pl-8">
            <div className="grid content-start gap-4">
              <ProofMetric icon={ShieldCheck} label="Final state" value="Approved and logged" />
              <ProofMetric icon={Fingerprint} label="Integrity" value="Hash verified" />
              <ProofMetric icon={Clock3} label="Review time" value="3 min 51 sec" />
            </div>

            <div className="mt-8 border border-background/20 p-6">
              <p className="mb-4 text-xs uppercase tracking-widest text-background/50">
                Buyer question
              </p>
              <blockquote className="text-2xl font-medium leading-snug tracking-tight md:text-3xl">
                How do I know what the agent actually did?
              </blockquote>
              <p className="mt-6 text-sm leading-relaxed text-background/60">
                The receipt is the product object: a sealed record of authority, evidence, approval, and outcome.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AnimatedSection>
  );
}

function EvidenceFrame({ label }: { label: string }) {
  return (
    <div className="border border-border bg-muted p-3">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>Captured</span>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-2/3 bg-foreground/20" />
        <div className="h-3 w-full bg-foreground/10" />
        <div className="h-3 w-4/5 bg-foreground/10" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="h-10 bg-foreground/10" />
          <div className="h-10 bg-foreground/10" />
          <div className="h-10 bg-foreground/20" />
        </div>
      </div>
    </div>
  );
}

function ProofMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 border border-background/20 p-5">
      <div className="flex h-11 w-11 flex-none items-center justify-center border border-background/20">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-background/50">{label}</p>
        <p className="mt-1 text-lg font-medium tracking-tight">{value}</p>
      </div>
    </div>
  );
}

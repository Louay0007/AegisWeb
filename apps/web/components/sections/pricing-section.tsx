import {
  ArrowRight,
  Building2,
  Check,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { AnimatedSection, MotionSurface } from "@/components/section-reveal";

const plans = [
  {
    name: "Starter",
    eyebrow: "Pilot workspace",
    price: "$299",
    cadence: "per month",
    description:
      "For small teams proving safe agent workflows across a focused set of vendor portals.",
    bestFor: "Founder-led ops and finance teams starting with invoice and renewal workflows.",
    icon: Workflow,
    features: [
      "3 controlled agents",
      "20 connected vendors",
      "500 web actions / month",
      "Core policy rules",
      "Receipt history",
    ],
    cta: "Start pilot",
    href: "/register",
  },
  {
    name: "Business",
    eyebrow: "Approval operating room",
    price: "$999",
    cadence: "per month",
    description:
      "For finance and operations teams that need approval gates, audit exports, and live workflow oversight.",
    bestFor: "Teams ready to run approval-gated renewals and plan changes every week.",
    icon: ShieldCheck,
    features: [
      "10 controlled agents",
      "100 connected vendors",
      "Dashboard and email approvals",
      "Audit and receipt exports",
      "Priority workflow support",
    ],
    cta: "Talk to sales",
    href: "/register",
    featured: true,
  },
  {
    name: "Enterprise",
    eyebrow: "Private trust layer",
    price: "Custom",
    cadence: "",
    description:
      "For organizations that need private deployment, SSO, compliance support, and advanced policy controls.",
    bestFor: "Security-sensitive teams deploying agent authority inside stricter environments.",
    icon: Building2,
    features: [
      "SSO and role governance",
      "Private deployment path",
      "Advanced policy controls",
      "Compliance support",
      "Dedicated security review",
    ],
    cta: "Design deployment",
    href: "/register",
  },
];

const assuranceItems = [
  {
    icon: LockKeyhole,
    label: "Credential boundary",
    value: "Raw secrets stay out of the UI, logs, receipts, and agent context.",
  },
  {
    icon: ShieldCheck,
    label: "Approval gates",
    value: "Risky actions pause before submission until a human approves.",
  },
  {
    icon: ReceiptText,
    label: "Audit receipts",
    value: "Every important action produces evidence, policy context, and final status.",
  },
];

const includedControls = [
  "Agent identities",
  "Credential vault",
  "Policy engine",
  "Controlled browser runtime",
  "Human approvals",
  "Evidence files",
  "Hash-chain audit trail",
  "Receipts",
];

export function PricingSection() {
  return (
    <AnimatedSection
      id="pricing"
      className="relative overflow-hidden bg-background px-6 py-20 md:px-12 md:py-28 lg:px-20"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border" />
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 border-b border-border pb-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:pb-14">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 border border-border bg-background px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
              Pricing
            </p>
            <h2 className="text-balance text-4xl font-medium leading-[0.98] tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Start with procurement agents. Keep authority under control.
            </h2>
          </div>
          <div className="max-w-2xl lg:justify-self-end">
            <p className="text-pretty text-base leading-8 text-muted-foreground md:text-lg">
              Every plan includes the same trust primitives: scoped agent identities, vaulted credentials, browser guardrails, approval gates, and receipts for sensitive web actions.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <PricingStat label="First wedge" value="SaaS renewals" />
              <PricingStat label="Risk model" value="Approval-first" />
              <PricingStat label="Evidence" value="Receipts" />
              <PricingStat label="Pilot path" value="30 days" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 py-8 lg:grid-cols-3 lg:gap-0 lg:border-b lg:border-border lg:py-0">
          {plans.map((plan) => (
            <MotionSurface
              key={plan.name}
              className={[
                "group relative flex min-h-[610px] flex-col overflow-hidden border p-6 transition-colors duration-200 lg:border-y-0 lg:border-l-0 lg:p-8",
                "border-border bg-background text-foreground lg:first:border-l lg:last:border-r-0",
                plan.featured
                  ? "border-foreground bg-foreground text-white shadow-[0_32px_120px_rgba(10,10,10,0.18)] lg:-mt-6 lg:min-h-[658px] lg:border lg:p-8"
                  : "hover:bg-muted/35",
              ].join(" ")}
            >
              {plan.featured ? (
                <div className="absolute inset-x-0 top-0 h-1 bg-background" />
              ) : null}

              <div className="flex items-start justify-between gap-5">
                <div>
                  <p
                    className={[
                      "mb-4 text-xs font-medium uppercase tracking-[0.16em]",
                      plan.featured ? "text-white/55" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {plan.eyebrow}
                  </p>
                  <h3 className="text-2xl font-medium tracking-tight">{plan.name}</h3>
                </div>
                <span
                  className={[
                    "flex size-11 shrink-0 items-center justify-center border",
                    plan.featured
                      ? "border-white/20 bg-white text-foreground"
                      : "border-border bg-muted text-foreground",
                  ].join(" ")}
                >
                  <plan.icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>

              {plan.featured ? (
                <div className="mt-7 inline-flex w-fit items-center gap-2 border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-white/80">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Most operational teams choose this
                </div>
              ) : null}

              <div className="mt-9 border-b pb-8 lg:mt-10">
                <div
                  className={[
                    "border-b pb-6",
                    plan.featured ? "border-white/15" : "border-border",
                  ].join(" ")}
                >
                  <div className="flex items-end gap-3">
                    <span
                      className={[
                        "text-5xl font-medium tracking-[-0.05em] md:text-6xl",
                        plan.featured ? "text-white" : "text-foreground",
                      ].join(" ")}
                    >
                      {plan.price}
                    </span>
                    {plan.cadence ? (
                      <span
                        className={[
                          "pb-2 text-sm",
                          plan.featured ? "text-white/58" : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {plan.cadence}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={[
                      "mt-5 text-sm leading-7",
                      plan.featured ? "text-white/68" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {plan.description}
                  </p>
                </div>

                <div className="pt-6">
                  <p
                    className={[
                      "text-xs font-medium uppercase tracking-[0.14em]",
                      plan.featured ? "text-white/60" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    Best for
                  </p>
                  <p
                    className={[
                      "mt-3 text-sm leading-7",
                      plan.featured ? "text-white" : "text-foreground",
                    ].join(" ")}
                  >
                    {plan.bestFor}
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <p
                  className={[
                    "mb-4 text-xs font-medium uppercase tracking-[0.14em]",
                    plan.featured ? "text-white/60" : "text-muted-foreground",
                  ].join(" ")}
                >
                  Included
                </p>
                <ul className="space-y-3.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-6">
                      <span
                        className={[
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center border",
                          plan.featured
                            ? "border-white/20 bg-white text-foreground"
                            : "border-border bg-background text-foreground",
                        ].join(" ")}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className={plan.featured ? "text-white" : "text-foreground"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={plan.href}
                className={[
                  "mt-auto inline-flex min-h-12 items-center justify-between gap-3 border px-4 py-3 text-sm font-semibold transition-[background-color,transform,border-color] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  plan.featured
                    ? "border-white bg-white text-foreground hover:bg-white/92 focus-visible:ring-offset-foreground"
                    : "border-foreground bg-foreground text-background hover:bg-foreground/88",
                ].join(" ")}
              >
                <span>{plan.cta}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </MotionSurface>
          ))}
        </div>

        <div className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:py-10">
          <MotionSurface className="border border-border bg-muted/45 p-6 lg:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Pilot option
                </p>
                <h3 className="text-2xl font-medium tracking-tight md:text-3xl">
                  Want proof before committing?
                </h3>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Early design partners can begin with a 30-day paid pilot focused on invoice downloads, renewal checks, and one approval-gated plan-change workflow.
                </p>
              </div>
              <div className="shrink-0 border border-border bg-background px-4 py-3 text-sm">
                <p className="font-medium tabular-nums">$200-$500 / month</p>
                <p className="mt-1 text-xs text-muted-foreground">or $1,000 paid pilot</p>
              </div>
            </div>
          </MotionSurface>

          <div className="grid gap-3 sm:grid-cols-2">
            {includedControls.map((item) => (
              <div key={item} className="flex items-center gap-3 border border-border p-4 text-sm">
                <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 pt-8 md:grid-cols-3">
          {assuranceItems.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="border border-border p-5">
                <div className="mb-5 flex size-10 items-center justify-center bg-foreground text-background">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-medium tracking-tight">{item.label}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.value}</p>
              </div>
            );
          })}
        </div>
      </div>
    </AnimatedSection>
  );
}

function PricingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-snug text-foreground">{value}</p>
    </div>
  );
}

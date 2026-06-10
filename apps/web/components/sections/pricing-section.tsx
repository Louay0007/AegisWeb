import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AnimatedSection, MotionSurface } from "@/components/section-reveal";

const plans = [
  {
    name: "Starter",
    price: "$299",
    cadence: "/ month",
    description: "For small teams proving safe agent workflows across vendor portals.",
    features: ["3 agents", "20 vendors", "500 actions / month", "Core policy rules"],
    cta: "Start pilot",
    href: "/register",
  },
  {
    name: "Business",
    price: "$999",
    cadence: "/ month",
    description: "For finance and operations teams running approvals and audit exports.",
    features: ["10 agents", "100 vendors", "Slack approvals", "Audit exports"],
    cta: "Talk to sales",
    href: "/register",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    description: "For teams that need private deployment, SSO, and advanced controls.",
    features: ["SSO", "Compliance support", "Private deployment", "Advanced policy controls"],
    cta: "Design deployment",
    href: "/register",
  },
];

export function PricingSection() {
  return (
    <AnimatedSection id="pricing" className="bg-background px-6 py-20 md:px-12 md:py-28 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 border-b border-border pb-12 md:grid-cols-[1fr_1.35fr] md:items-end">
          <div>
            <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
              Pricing
            </p>
            <h2 className="max-w-2xl text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              Start with safe SaaS renewal automation. Scale into agent trust infrastructure.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:justify-self-end md:text-lg">
            Every plan is built around controlled agent identities, scoped credentials, approval gates, and receipts for web actions.
          </p>
        </div>

        <div className="grid border-b border-border md:grid-cols-3">
          {plans.map((plan) => (
            <MotionSurface
              key={plan.name}
              className={[
                "flex min-h-[460px] flex-col border-border py-8 md:border-r md:px-8",
                "border-b last:border-b-0 md:border-b-0 md:first:pl-0 md:last:border-r-0 md:last:pr-0",
                plan.featured ? "bg-foreground px-6 text-background md:-mt-px md:px-8" : "px-0 text-foreground",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-medium tracking-tight">{plan.name}</h3>
                {plan.featured ? (
                  <span className="inline-flex items-center gap-2 border border-background/20 px-3 py-1 text-xs uppercase tracking-widest text-background/80">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Most used
                  </span>
                ) : null}
              </div>

              <div className="mt-10">
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-medium tracking-tight">{plan.price}</span>
                  {plan.cadence ? (
                    <span className={plan.featured ? "pb-2 text-sm text-background/60" : "pb-2 text-sm text-muted-foreground"}>
                      {plan.cadence}
                    </span>
                  ) : null}
                </div>
                <p className={plan.featured ? "mt-5 text-sm leading-relaxed text-background/70" : "mt-5 text-sm leading-relaxed text-muted-foreground"}>
                  {plan.description}
                </p>
              </div>

              <ul className="mt-10 space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 flex-none" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={[
                  "mt-auto inline-flex min-h-11 items-center justify-between gap-3 border px-4 py-3 text-sm font-medium transition-colors duration-200",
                  plan.featured
                    ? "border-background bg-background text-foreground hover:bg-background/90"
                    : "border-border text-foreground hover:bg-muted",
                ].join(" ")}
              >
                <span>{plan.cta}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </MotionSurface>
          ))}
        </div>

        <div className="grid gap-6 pt-8 text-sm text-muted-foreground md:grid-cols-3">
          <p>Early pilots can start at $200-$500/month or a paid 30-day pilot.</p>
          <p>Low-risk workflows first: invoice downloads, renewal checks, and receipt generation.</p>
          <p>Risky actions stay paused until a human approval policy allows them.</p>
        </div>
      </div>
    </AnimatedSection>
  );
}

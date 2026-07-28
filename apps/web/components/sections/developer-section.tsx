import { ArrowRight, Code2, GitBranch, MessageSquare, PlugZap, Webhook } from "lucide-react";
import Link from "next/link";
import { AnimatedSection, MotionSurface, SectionReveal } from "@/components/section-reveal";

const integrations = [
  {
    icon: MessageSquare,
    title: "Email approvals",
    description: "Notify finance and ops when an agent action needs a human decision.",
  },
  {
    icon: Webhook,
    title: "Webhooks",
    description: "Notify internal systems when runs complete, fail, or require review.",
  },
  {
    icon: GitBranch,
    title: "Agent frameworks",
    description: "Let agents ask for policy decisions before executing browser actions.",
  },
];

const codeLines = [
  "const decision = await aegis.actions.check({",
  '  agent: "procurement-bot",',
  '  vendor: "acme-billing",',
  '  action: "downgrade-plan",',
  "});",
  "",
  "if (decision.requiresApproval) {",
  "  await aegis.approvals.request(decision);",
  "}",
];

export function DeveloperSection() {
  return (
    <AnimatedSection id="developers" className="bg-background px-6 py-20 md:px-12 md:py-28 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid min-w-0 gap-12 border-y border-border py-12 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionReveal>
            <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Platform</p>
            <h2 className="max-w-3xl text-4xl font-medium tracking-tight text-foreground md:text-5xl">
              Built for agent builders and operators.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Start with hosted dashboard workflows. Expand into API checks, approvals, receipts, and event streams when your agents need deeper control.
            </p>
            <Link
              href="/register"
              className="mt-10 inline-flex min-h-11 items-center gap-3 border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted"
            >
              <span>Build with AegisWeb</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </SectionReveal>

          <MotionSurface className="min-w-0 border border-border bg-foreground p-5 text-background">
            <div className="mb-5 flex items-center justify-between border-b border-background/20 pb-4">
              <div className="flex items-center gap-3">
                <Code2 className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-medium">policy-check.ts</span>
              </div>
              <span className="text-xs uppercase tracking-widest text-background/50">SDK</span>
            </div>
            <pre className="min-w-0 overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-7 text-background/75">
              <code>{codeLines.join("\n")}</code>
            </pre>
          </MotionSurface>
        </div>

        <div className="grid border-b border-border lg:grid-cols-3">
          {integrations.map((item, index) => {
            const Icon = item.icon;

            return (
              <SectionReveal
                key={item.title}
                delay={index === 0 ? "none" : index === 1 ? "short" : "medium"}
                className="border-b border-border py-8 lg:border-b-0 lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
              >
                <div className="mb-8 flex h-11 w-11 items-center justify-center border border-border">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-medium tracking-tight text-foreground">{item.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </SectionReveal>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 border-b border-border py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="inline-flex items-center gap-2">
            <PlugZap className="h-4 w-4" aria-hidden="true" />
            Neutral infrastructure across browser agents, workers, and internal tools.
          </div>
          <span>API, SDK, and webhooks after the hosted MVP wedge.</span>
        </div>
      </div>
    </AnimatedSection>
  );
}

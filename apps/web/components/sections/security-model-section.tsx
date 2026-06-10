import { Bot, Braces, KeyRound, Monitor, ReceiptText, ShieldCheck } from "lucide-react";
import { AnimatedSection, SectionReveal } from "@/components/section-reveal";

const layers = [
  {
    icon: Bot,
    title: "Agent identity",
    description: "Every agent has a purpose, owner, status, and explicit website scope.",
  },
  {
    icon: ShieldCheck,
    title: "Policy engine",
    description: "Website, action, spend, data, and time rules decide what can happen next.",
  },
  {
    icon: KeyRound,
    title: "Credential vault",
    description: "Secrets are injected into sessions without exposing passwords to the agent.",
  },
  {
    icon: Monitor,
    title: "Controlled runtime",
    description: "Browser events, screenshots, downloads, and submit actions are observed.",
  },
  {
    icon: ReceiptText,
    title: "Audit receipts",
    description: "Each important action receives timestamps, evidence, hashes, and approvals.",
  },
];

export function SecurityModelSection() {
  return (
    <AnimatedSection id="security" className="bg-muted px-6 py-20 md:px-12 md:py-28 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <SectionReveal className="max-w-4xl">
          <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Security model</p>
          <h2 className="text-4xl font-medium tracking-tight text-foreground md:text-5xl">
            Authority is separated into layers.
          </h2>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            AegisWeb does not ask you to trust a browser agent blindly. It places identity, policy, credentials, runtime control, and receipts into separate checks.
          </p>
        </SectionReveal>

        <div className="mt-14 grid border-y border-border lg:grid-cols-[0.9fr_1.2fr]">
          <SectionReveal className="border-b border-border py-8 lg:border-b-0 lg:border-r lg:pr-8">
            <div className="flex min-h-[340px] flex-col justify-between bg-foreground p-6 text-background">
              <div>
                <div className="mb-8 inline-flex items-center gap-2 border border-background/20 px-3 py-1 text-xs uppercase tracking-widest text-background/60">
                  <Braces className="h-3.5 w-3.5" aria-hidden="true" />
                  Permission graph
                </div>
                <div className="space-y-4 font-mono text-sm">
                  <p>{'agent.purpose = "saas-renewals"'}</p>
                  <p>{'vendor.scope = ["billing", "invoices"]'}</p>
                  <p>{'credential.exposure = "never"'}</p>
                  <p>{'action.downgrade = "requires_approval"'}</p>
                  <p>{'receipt.integrity = "sha256_verified"'}</p>
                </div>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-background/60">
                Policies become operational guardrails before the agent can commit sensitive web actions.
              </p>
            </div>
          </SectionReveal>

          <div className="grid md:grid-cols-2">
            {layers.map((layer, index) => {
              const Icon = layer.icon;

              return (
                <SectionReveal
                  key={layer.title}
                  delay={index % 2 ? "short" : "none"}
                  className="min-h-52 border-b border-r border-border p-6 even:border-r-0 last:border-b-0 md:[&:nth-last-child(2)]:border-b-0"
                >
                  <div className="mb-8 flex h-11 w-11 items-center justify-center border border-border bg-background">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-medium tracking-tight text-foreground">{layer.title}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{layer.description}</p>
                </SectionReveal>
              );
            })}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

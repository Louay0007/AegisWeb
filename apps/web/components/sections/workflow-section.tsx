import { ArrowRight, CheckCircle2, CircleDot, FileText, ListChecks, PauseCircle } from "lucide-react";
import { AnimatedSection, SectionReveal } from "@/components/section-reveal";

const steps = [
  {
    icon: CircleDot,
    label: "Detect",
    title: "Renewal risk appears",
    description: "The agent finds a price increase, renewal date, or billing change across a vendor portal.",
    meta: "Trigger: $800 -> $1,100 / month",
  },
  {
    icon: FileText,
    label: "Collect",
    title: "Evidence is captured",
    description: "Invoices, screenshots, page state, and downloaded files are attached to the workflow run.",
    meta: "Evidence: invoice, screenshot, hash",
  },
  {
    icon: PauseCircle,
    label: "Gate",
    title: "Risk pauses action",
    description: "Policy rules decide whether the agent may continue, must ask, or must stop.",
    meta: "Decision: approval required",
  },
  {
    icon: CheckCircle2,
    label: "Record",
    title: "Receipt closes the loop",
    description: "The final approval, action, and outcome become a sealed audit record for the team.",
    meta: "Outcome: approved and logged",
  },
];

export function WorkflowSection() {
  return (
    <AnimatedSection id="workflows" className="bg-background px-6 py-20 md:px-12 md:py-28 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 border-b border-border pb-12 md:grid-cols-[0.85fr_1.15fr] md:items-end">
          <SectionReveal>
            <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Workflow</p>
            <h2 className="max-w-3xl text-4xl font-medium tracking-tight text-foreground md:text-5xl">
              From browser action to auditable outcome.
            </h2>
          </SectionReveal>
          <SectionReveal delay="short" className="md:justify-self-end">
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              AegisWeb turns fragile web automation into a controlled sequence: detect, collect, gate, and record.
            </p>
          </SectionReveal>
        </div>

        <div className="grid border-b border-border lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <SectionReveal
                key={step.label}
                delay={index > 1 ? "medium" : index === 1 ? "short" : "none"}
                className="relative border-b border-border py-8 lg:border-b-0 lg:border-r lg:px-6 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center border border-border bg-background">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  {index < steps.length - 1 ? (
                    <ArrowRight className="hidden h-4 w-4 text-muted-foreground lg:block" aria-hidden="true" />
                  ) : null}
                </div>
                <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">{step.label}</p>
                <h3 className="text-2xl font-medium tracking-tight text-foreground">{step.title}</h3>
                <p className="mt-4 min-h-20 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                <div className="mt-8 border border-border bg-muted px-4 py-3 text-sm text-foreground">
                  {step.meta}
                </div>
              </SectionReveal>
            );
          })}
        </div>

        <div className="grid gap-6 pt-8 md:grid-cols-[1fr_2fr]">
          <div className="inline-flex w-fit items-center gap-2 border border-border px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground">
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            Operational path
          </div>
          <p className="max-w-3xl text-lg leading-relaxed text-foreground md:text-2xl">
            Low-risk reads move quickly. Sensitive clicks pause. Every completed run leaves proof.
          </p>
        </div>
      </div>
    </AnimatedSection>
  );
}

import { CheckCircle2, PauseCircle, ReceiptText } from "lucide-react";
import { AnimatedSection, MotionSurface } from "@/components/section-reveal";

const principles = [
  {
    icon: CheckCircle2,
    title: "Permission before autonomy",
    description: "Agents only act inside explicit boundaries for websites, workflows, actions, time, and spend.",
  },
  {
    icon: PauseCircle,
    title: "Human approval for risk",
    description: "Low-risk reads can move quickly. Billing, cancellations, admin changes, and purchases pause for review.",
  },
  {
    icon: ReceiptText,
    title: "Every action leaves proof",
    description: "Screenshots, timestamps, policy decisions, approval records, and hashes become a durable receipt.",
  },
];

export function PhilosophySection() {
  return (
    <AnimatedSection id="principles" className="bg-background px-6 py-20 md:px-12 md:py-28 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 border-b border-border pb-12 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <div>
            <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
              Principles
            </p>
            <h2 className="max-w-3xl text-4xl font-medium tracking-tight text-foreground md:text-5xl">
              Give agents capability without handing them authority.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:justify-self-end md:text-lg">
            AegisWeb gives each web agent a controlled identity, scoped credentials, approval rules, and an audit trail that operators can trust.
          </p>
        </div>

        <div className="grid border-b border-border md:grid-cols-3">
          {principles.map((principle) => {
            const Icon = principle.icon;

            return (
              <MotionSurface
                key={principle.title}
                className="border-b border-border py-8 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
              >
                <div className="mb-8 flex h-11 w-11 items-center justify-center border border-border">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-2xl font-medium tracking-tight text-foreground">
                  {principle.title}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {principle.description}
                </p>
              </MotionSurface>
            );
          })}
        </div>
      </div>
    </AnimatedSection>
  );
}

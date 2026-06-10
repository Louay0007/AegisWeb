import { ChevronDown } from "lucide-react";
import { AnimatedSection, SectionReveal } from "@/components/section-reveal";

const faqs = [
  {
    question: "Is AegisWeb another browser agent?",
    answer: "No. AegisWeb controls authority around agents: identity, credentials, approvals, policy decisions, and receipts.",
  },
  {
    question: "What is the first workflow?",
    answer: "The first wedge is SaaS vendor management: invoices, renewals, seat usage, plan changes, and approval receipts.",
  },
  {
    question: "Do agents see raw passwords?",
    answer: "No. Credentials are stored in a vault and injected into controlled sessions without exposing raw secrets to the agent.",
  },
  {
    question: "What happens when an action is risky?",
    answer: "The policy engine pauses the workflow, creates an approval request, and only resumes when a permitted human approves.",
  },
  {
    question: "Why would finance or ops care?",
    answer: "They get useful automation without losing control over billing, vendor access, approvals, or audit evidence.",
  },
];

export function FaqSection() {
  return (
    <AnimatedSection id="faq" className="bg-muted px-6 py-20 md:px-12 md:py-28 lg:px-20">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionReveal>
          <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Questions</p>
          <h2 className="text-4xl font-medium tracking-tight text-foreground md:text-5xl">
            The trust layer, made concrete.
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            The product starts narrow because safe agent operations need proof before breadth.
          </p>
        </SectionReveal>

        <div className="border-y border-border">
          {faqs.map((item, index) => (
            <SectionReveal key={item.question} delay={index % 2 ? "short" : "none"}>
              <details className="group border-b border-border py-6 last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-lg font-medium tracking-tight text-foreground">
                  <span>{item.question}</span>
                  <ChevronDown className="h-5 w-5 flex-none text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </details>
            </SectionReveal>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

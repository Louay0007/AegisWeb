"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Cookie,
  FileText,
  LockKeyhole,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import type { PolicyIconName, PolicyPageContent } from "./policy-content";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const policyIcons: Record<PolicyIconName, typeof ShieldCheck> = {
  cookie: Cookie,
  file: FileText,
  lock: LockKeyhole,
  scale: Scale,
  shield: ShieldCheck,
};

export function PolicyPage({ policy }: { policy: PolicyPageContent }) {
  const rootRef = useRef<HTMLElement | null>(null);
  const Icon = policyIcons[policy.icon];

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const root = rootRef.current;
      if (!root) return;

      if (reduceMotion) {
        gsap.set([".legal-hero-item", ".legal-card", ".legal-section"], {
          autoAlpha: 1,
          y: 0,
          clearProps: "transform,visibility",
        });
        return;
      }

      gsap.fromTo(
        ".legal-hero-item",
        { autoAlpha: 0, y: 32, filter: "blur(10px)" },
        {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.95,
          ease: "power3.out",
          stagger: 0.08,
          clearProps: "transform,filter,visibility",
        },
      );

      gsap.fromTo(
        ".legal-card",
        { autoAlpha: 0, y: 28, scale: 0.985 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.85,
          ease: "power3.out",
          stagger: 0.06,
          clearProps: "transform,visibility",
          scrollTrigger: {
            trigger: ".legal-summary-grid",
            start: "top 82%",
            once: true,
          },
        },
      );

      gsap.utils.toArray<HTMLElement>(".legal-section").forEach((section) => {
        gsap.fromTo(
          section,
          { autoAlpha: 0, y: 42, filter: "blur(8px)" },
          {
            autoAlpha: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.9,
            ease: "power3.out",
            clearProps: "transform,filter,visibility",
            scrollTrigger: {
              trigger: section,
              start: "top 84%",
              once: true,
            },
          },
        );
      });
    },
    { scope: rootRef },
  );

  return (
    <main ref={rootRef} className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border px-6 pb-16 pt-8 md:px-12 md:pb-24 lg:px-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(10,10,10,0.075),transparent_30%),linear-gradient(180deg,rgba(245,245,245,0.7),transparent_55%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="legal-hero-item mb-14 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 border border-border bg-background/80 px-3 py-2 text-sm font-medium text-foreground shadow-xs backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back home
            </Link>
            <Link
              href="/register"
              className="hidden min-h-10 items-center gap-2 bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-flex"
            >
              Start pilot
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div className="legal-hero-item">
              <div className="mb-6 inline-flex items-center gap-2 border border-border bg-background/80 px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground shadow-xs backdrop-blur">
                <Icon className="size-4" aria-hidden="true" />
                {policy.eyebrow}
              </div>
              <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-1">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  <span>Effective {policy.effectiveAt}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="size-4" aria-hidden="true" />
                  <span>Updated {policy.updatedAt}</span>
                </div>
              </div>
            </div>

            <div>
              <h1 className="legal-hero-item max-w-5xl text-balance text-5xl font-medium leading-[0.95] tracking-tight md:text-7xl lg:text-8xl">
                {policy.title}
              </h1>
              <p className="legal-hero-item mt-7 max-w-3xl text-pretty text-base leading-7 text-muted-foreground md:text-xl md:leading-8">
                {policy.description}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:px-12 lg:px-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <aside className="lg:sticky lg:top-24">
            <div className="legal-card border border-border bg-muted/40 p-5 shadow-xs">
              <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
                On this page
              </p>
              <nav aria-label={`${policy.eyebrow} sections`}>
                <ol className="space-y-1">
                  {policy.sections.map((section, index) => (
                    <li key={section.id}>
                      <Link
                        href={`#${section.id}`}
                        className="group grid grid-cols-[2rem_1fr] items-center gap-2 px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-pretty">{section.title}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="legal-summary-grid mb-8 grid gap-3 md:grid-cols-3">
              {policy.summary.map((item) => (
                <div
                  key={item}
                  className="legal-card border border-border bg-background p-5 shadow-xs"
                >
                  <div className="mb-5 flex size-9 items-center justify-center border border-border bg-muted">
                    <Check className="size-4" aria-hidden="true" />
                  </div>
                  <p className="text-pretty text-sm leading-6 text-muted-foreground">
                    {item}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-y border-border">
              {policy.sections.map((section, index) => (
                <article
                  id={section.id}
                  key={section.id}
                  className="legal-section scroll-mt-28 border-b border-border py-10 last:border-b-0 md:py-12"
                >
                  <div className="grid gap-6 md:grid-cols-[8rem_1fr]">
                    <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground md:text-3xl">
                        {section.title}
                      </h2>
                      <div className="mt-5 space-y-4">
                        {section.body.map((paragraph) => (
                          <p
                            key={paragraph}
                            className="text-pretty text-base leading-8 text-muted-foreground"
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>
                      {section.bullets ? (
                        <ul className="mt-6 grid gap-3">
                          {section.bullets.map((bullet) => (
                            <li
                              key={bullet}
                              className="grid grid-cols-[1.75rem_1fr] gap-3 text-pretty text-sm leading-7 text-foreground"
                            >
                              <span className="mt-1 flex size-5 items-center justify-center border border-border bg-muted">
                                <Check className="size-3" aria-hidden="true" />
                              </span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-10 border border-border bg-foreground p-6 text-background shadow-[0_24px_80px_rgba(10,10,10,0.16)] md:p-8">
              <p className="text-xs uppercase tracking-widest text-background/55">
                Need help?
              </p>
              <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <p className="max-w-2xl text-pretty text-2xl font-medium leading-tight tracking-tight md:text-3xl">
                  Questions about this policy should be reviewed with your
                  legal, security, or operations owner.
                </p>
                <Link
                  href="/register"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-background/20 px-4 py-3 text-sm font-medium transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
                >
                  Talk to AegisWeb
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

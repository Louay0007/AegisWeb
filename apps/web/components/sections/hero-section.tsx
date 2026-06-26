"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, KeyRound, ShieldCheck, Workflow } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const eventRows = [
  {
    icon: ShieldCheck,
    label: "Policy check",
    value: "Allowed with approval",
  },
  {
    icon: KeyRound,
    label: "Credential grant",
    value: "Scoped to Acme Billing",
  },
  {
    icon: Workflow,
    label: "Workflow state",
    value: "Paused before submit",
  },
];

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const revealTargets = gsap.utils.toArray<HTMLElement>(".hero-reveal");
      const panelRows = gsap.utils.toArray<HTMLElement>(".hero-panel-row");
      const beams = gsap.utils.toArray<HTMLElement>(".hero-beam");

      gsap.set(revealTargets, { autoAlpha: 0, y: 28 });
      gsap.set(".hero-command-panel", {
        autoAlpha: 0,
        y: 34,
        scale: 0.96,
        transformOrigin: "50% 80%",
      });
      gsap.set(panelRows, { autoAlpha: 0, x: 22 });
      gsap.set(beams, { scaleX: 0, transformOrigin: "0% 50%" });
      gsap.set(".hero-signal", { autoAlpha: 0, scale: 0.88 });

      if (reduceMotion) {
        gsap.set([revealTargets, ".hero-command-panel", panelRows], {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
        });
        gsap.set(beams, { scaleX: 1 });
        gsap.set(".hero-signal", { autoAlpha: 1, scale: 1 });
        return;
      }

      const intro = gsap.timeline({
        defaults: { ease: "power3.out", duration: 0.72 },
      });

      intro
        .to(revealTargets, {
          autoAlpha: 1,
          y: 0,
          stagger: 0.08,
        })
        .to(
          ".hero-command-panel",
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.9,
            ease: "expo.out",
          },
          "-=0.42",
        )
        .to(
          panelRows,
          {
            autoAlpha: 1,
            x: 0,
            stagger: 0.07,
            duration: 0.48,
          },
          "-=0.48",
        )
        .to(
          beams,
          {
            scaleX: 1,
            stagger: 0.08,
            duration: 0.7,
            ease: "power2.inOut",
          },
          "-=0.32",
        )
        .to(
          ".hero-signal",
          {
            autoAlpha: 1,
            scale: 1,
            stagger: 0.06,
            duration: 0.42,
          },
          "-=0.36",
        );

      gsap.to(".hero-signal", {
        y: -8,
        duration: 2.2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 0.2,
      });

      gsap.to(".hero-command-panel", {
        yPercent: -7,
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom top",
          scrub: 0.8,
        },
      });

      gsap.to(".hero-copy", {
        yPercent: 5,
        autoAlpha: 0.72,
        scrollTrigger: {
          trigger: section,
          start: "30% top",
          end: "bottom top",
          scrub: 0.8,
        },
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="relative isolate overflow-hidden bg-background pt-24 text-[#0b0d0c] md:pt-28"
    >
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,13,12,0.06)_1px,transparent_1px),linear-gradient(180deg,rgba(11,13,12,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-white to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-36 bg-linear-to-b from-transparent via-background/85 to-background" />

      <div className="relative z-10 mx-auto grid min-h-[calc(100dvh-6rem)] w-full max-w-7xl items-center gap-12 px-6 pb-14 md:px-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:pb-18">
        <div className="hero-copy max-w-3xl">
          <p className="hero-reveal mb-6 inline-flex items-center gap-2 border border-[#0b0d0c]/15 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#2d3a35] shadow-[0_18px_60px_rgba(11,13,12,0.08)]">
            Trust layer for web agents
          </p>

          <h1 className="hero-reveal max-w-[12ch] text-5xl font-semibold leading-[0.94] tracking-normal text-[#0b0d0c] sm:text-6xl lg:text-7xl xl:text-8xl">
            AI agents, under control.
          </h1>

          <p className="hero-reveal mt-7 max-w-xl text-lg leading-8 text-[#44504b] md:text-xl">
            AegisWeb gates credentials, approvals, browser actions, and receipts for AI procurement workflows.
          </p>

          <div className="hero-reveal mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#0b0d0c] px-6 text-sm font-semibold text-white transition-transform duration-150 ease-out hover:bg-[#1b211f] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0d0c] focus-visible:ring-offset-2"
            >
              Start free
              <ArrowRight aria-hidden="true" size={17} strokeWidth={2} />
            </Link>
            <Link
              href="#workflows"
              className="inline-flex min-h-12 items-center justify-center border border-[#0b0d0c]/18 bg-white/75 px-6 text-sm font-semibold text-[#0b0d0c] transition-transform duration-150 ease-out hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0d0c] focus-visible:ring-offset-2"
            >
              See workflow
            </Link>
          </div>
        </div>

        <div className="relative min-h-[520px] lg:min-h-[650px]">
          <div className="hero-signal absolute left-6 top-10 hidden h-24 w-24 border border-[#0b0d0c]/12 bg-white/70 shadow-[0_24px_80px_rgba(11,13,12,0.09)] md:block" />
          <div className="hero-signal absolute right-3 top-28 h-16 w-16 bg-[#d9f573] shadow-[0_22px_70px_rgba(126,157,18,0.24)]" />
          <div className="hero-signal absolute bottom-20 left-0 hidden h-20 w-20 border border-[#0b0d0c]/12 bg-[#0b0d0c] md:block" />

          <div className="hero-command-panel relative ml-auto flex h-full max-w-2xl flex-col border border-[#0b0d0c]/14 bg-[#0b0d0c] p-3 text-white shadow-[0_34px_120px_rgba(11,13,12,0.28)]">
            <div className="flex items-center justify-between border border-white/10 bg-white/[0.06] px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/60">
                  Live run
                </p>
                <p className="mt-1 font-medium">Acme downgrade request</p>
              </div>
              <div className="bg-[#d9f573] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#0b0d0c]">
                Approval pending
              </div>
            </div>

            <div className="relative mt-3 grid flex-1 gap-3 lg:grid-cols-[1fr_0.92fr]">
              <div className="border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Agent</span>
                  <span>procurement-bot</span>
                </div>
                <div className="mt-7 space-y-3">
                  {eventRows.map((row) => {
                    const Icon = row.icon;

                    return (
                      <div
                        key={row.label}
                        className="hero-panel-row border border-white/10 bg-[#151917] p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center bg-white text-[#0b0d0c]">
                            <Icon aria-hidden="true" size={18} strokeWidth={2} />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {row.label}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-white/58">
                              {row.value}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative overflow-hidden border border-white/10 bg-[#f7f8f4] p-4 text-[#0b0d0c]">
                <div className="absolute left-0 right-0 top-20 space-y-16">
                  <span className="hero-beam block h-px bg-[#0b0d0c]/24" />
                  <span className="hero-beam block h-px bg-[#0b0d0c]/24" />
                  <span className="hero-beam block h-px bg-[#0b0d0c]/24" />
                </div>

                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#526059]">
                  Controlled browser
                </p>
                <div className="mt-5 border border-[#0b0d0c]/15 bg-white p-3 shadow-[0_18px_60px_rgba(11,13,12,0.08)]">
                  <div className="flex items-center gap-1.5 border-b border-[#0b0d0c]/10 pb-3">
                    <span className="size-2 bg-[#0b0d0c]/25" />
                    <span className="size-2 bg-[#0b0d0c]/25" />
                    <span className="size-2 bg-[#0b0d0c]/25" />
                    <span className="ml-3 h-5 flex-1 bg-[#edf0e8]" />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="h-24 bg-[#0b0d0c]" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-16 bg-[#edf0e8]" />
                      <div className="h-16 bg-[#d9f573]" />
                    </div>
                    <div className="h-10 border border-[#0b0d0c]/15 bg-white" />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="hero-panel-row bg-[#0b0d0c] p-3 text-white">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/60">
                      Spend cap
                    </p>
                    <p className="mt-2 text-2xl font-semibold">$0</p>
                  </div>
                  <div className="hero-panel-row border border-[#0b0d0c]/15 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#526059]">
                      Receipt
                    </p>
                    <p className="mt-2 text-2xl font-semibold">Ready</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 text-sm text-white/62 md:grid-cols-3">
              <div className="border border-white/10 bg-white/[0.04] p-3">
                acme.com allowed
              </div>
              <div className="border border-white/10 bg-white/[0.04] p-3">
                raw password hidden
              </div>
              <div className="border border-white/10 bg-white/[0.04] p-3">
                hash chain logged
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

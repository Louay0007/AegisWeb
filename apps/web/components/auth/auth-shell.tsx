"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import {
  ArrowLeft,
  CheckCircle,
  Fingerprint,
  IconoirProvider,
  Key,
  PasswordCheck,
} from "iconoir-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { BrandLogo } from "@/components/brand/brand-logo";

gsap.registerPlugin(useGSAP);

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const trustSignals = [
  "Scoped agent identities",
  "Approval gates before risk",
  "Credential vault boundaries",
];

const controlCards = [
  {
    icon: Fingerprint,
    label: "Identity",
    value: "Agent verified",
  },
  {
    icon: PasswordCheck,
    label: "Decision",
    value: "Approval required",
  },
  {
    icon: CheckCircle,
    label: "Receipt",
    value: "Evidence sealed",
  },
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: AuthShellProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const { contextSafe } = useGSAP(
    () => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reduceMotion) {
        gsap.set([".auth-reveal", ".auth-card", ".auth-control-card"], {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          clearProps: "transform,visibility",
        });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        ".auth-nav",
        { autoAlpha: 0, y: -18 },
        { autoAlpha: 1, y: 0, duration: 0.65 },
      )
        .fromTo(
          ".auth-reveal",
          { autoAlpha: 0, y: 38, filter: "blur(10px)" },
          {
            autoAlpha: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.9,
            stagger: 0.08,
            clearProps: "transform,filter,visibility",
          },
          "-=0.25",
        )
        .fromTo(
          ".auth-card",
          { autoAlpha: 0, x: 44, scale: 0.98, filter: "blur(10px)" },
          {
            autoAlpha: 1,
            x: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 0.95,
            clearProps: "transform,filter,visibility",
          },
          "-=0.7",
        )
        .fromTo(
          ".auth-control-card",
          { autoAlpha: 0, y: 24, scale: 0.96 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.65,
            stagger: 0.075,
            clearProps: "transform,visibility",
          },
          "-=0.55",
        );

      gsap.to(".auth-float", {
        y: -6,
        duration: 4.2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 0.25,
      });
    },
    { scope: rootRef },
  );

  const handleCardEnter = contextSafe(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion || !cardRef.current) return;

    gsap.to(cardRef.current, {
      y: -8,
      duration: 0.34,
      ease: "power3.out",
      overwrite: "auto",
    });
  });

  const handleCardLeave = contextSafe(() => {
    if (!cardRef.current) return;

    gsap.to(cardRef.current, {
      y: 0,
      duration: 0.42,
      ease: "power3.out",
      overwrite: "auto",
      clearProps: "transform",
    });
  });

  return (
    <main
      ref={rootRef}
      className="relative min-h-screen overflow-hidden bg-background text-foreground"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(10,10,10,0.09),transparent_28%),radial-gradient(circle_at_84%_16%,rgba(10,10,10,0.06),transparent_24%),linear-gradient(180deg,#fff,rgba(245,245,245,0.92))]" />
      <div className="pointer-events-none absolute inset-x-0 top-10 text-center text-[clamp(5rem,18vw,18rem)] font-bold leading-none tracking-[-0.08em] text-foreground/[0.035]">
        AegisWeb
      </div>

      <header className="auth-nav relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <IconoirProvider iconProps={{ strokeWidth: 1.7 }}>
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-3 text-sm font-medium tracking-tight transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandLogo variant="primary" className="h-8 w-36" priority />
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 border border-border bg-background/80 px-4 py-2 text-sm font-medium text-foreground shadow-xs backdrop-blur transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to site
          </Link>
        </IconoirProvider>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl items-center gap-10 px-5 pb-12 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,500px)] lg:gap-16">
        <div className="min-w-0">
          <div className="auth-reveal mb-6 inline-flex items-center gap-2 border border-border bg-background/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground shadow-xs backdrop-blur">
            <Key className="size-4" aria-hidden="true" />
            {eyebrow}
          </div>

          <h1 className="auth-reveal max-w-3xl text-balance text-5xl font-semibold leading-[0.94] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            {title}
          </h1>
          <p className="auth-reveal mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            {description}
          </p>

          <div className="auth-reveal mt-8 grid gap-3 sm:max-w-xl sm:grid-cols-3">
            {trustSignals.map((signal) => (
              <div
                key={signal}
                className="flex items-center gap-2 border border-border bg-background/70 px-3 py-2 text-sm text-muted-foreground shadow-xs backdrop-blur"
              >
                <CheckCircle
                  className="size-4 shrink-0 text-foreground"
                  aria-hidden="true"
                />
                <span className="text-pretty leading-5">{signal}</span>
              </div>
            ))}
          </div>

          <div className="auth-reveal mt-10 hidden max-w-2xl grid-cols-3 gap-3 md:grid">
            {controlCards.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="auth-control-card auth-float border border-border bg-background/80 p-4 shadow-xs backdrop-blur"
                >
                  <div className="mb-5 flex size-11 items-center justify-center border border-border bg-muted">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="auth-card relative min-w-0">
          <div className="absolute -inset-3 border border-border/70 bg-background/35 shadow-[0_20px_70px_rgba(10,10,10,0.08)] backdrop-blur-sm" />
          <div
            ref={cardRef}
            className="relative border border-border bg-background p-5 shadow-[0_28px_100px_rgba(10,10,10,0.14)] sm:p-6"
            onPointerEnter={handleCardEnter}
            onPointerLeave={handleCardLeave}
          >
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}

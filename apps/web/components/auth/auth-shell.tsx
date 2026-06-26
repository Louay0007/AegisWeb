"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import {
  ArrowLeft,
  IconoirProvider,
  Key,
} from "iconoir-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { BrandLogo } from "@/components/brand/brand-logo";

gsap.registerPlugin(useGSAP);

type AuthShellProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
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
        gsap.set([".auth-reveal", ".auth-card"], {
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
        );
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

"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function Hero({
  eyebrow = "Innovate Without Limits",
  title,
  subtitle,
  ctaLabel = "Explore Now",
  ctaHref = "#",
}: HeroProps) {
  return (
    <section
      id="hero"
      className="relative mx-auto min-h-[calc(100vh-40px)] w-full overflow-hidden rounded-b-xl bg-[linear-gradient(to_bottom,#fff,#ffffff_50%,#e8e8e8_88%)] px-6 pt-40 text-center dark:bg-[linear-gradient(to_bottom,#000,#0000_30%,#898e8e_78%,#ffffff_99%_50%)] md:px-8"
    >
      <div className="absolute inset-0 -z-10 h-[600px] w-full bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_5rem] opacity-80 [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] dark:bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)]" />

      <div className="animate-fade-up absolute left-1/2 top-[calc(100%-90px)] h-[500px] w-[700px] -translate-x-1/2 rounded-[100%] border-[#B48CDE] bg-white bg-[radial-gradient(closest-side,#fff_82%,#000000)] md:h-[500px] md:w-[1100px] lg:top-[calc(100%-150px)] lg:h-[750px] lg:w-[140%] dark:bg-black dark:bg-[radial-gradient(closest-side,#000_82%,#ffffff)]" />

      {eyebrow && (
        <a href="#" className="group">
          <span className="mx-auto flex w-fit items-center justify-center rounded-3xl border-2 border-gray-300/20 bg-gradient-to-tr from-zinc-300/5 via-gray-400/5 to-transparent px-5 py-2 text-sm uppercase tracking-tight text-gray-600 dark:border-white/5 dark:text-gray-400">
            {eyebrow}
            <ChevronRight className="ml-2 inline size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </a>
      )}

      <h1 className="animate-fade-in -translate-y-4 bg-gradient-to-br from-black from-30% to-black/40 bg-clip-text py-6 text-5xl font-semibold leading-none tracking-tighter text-balance text-transparent opacity-0 sm:text-6xl md:text-7xl lg:text-8xl dark:from-white dark:to-white/40">
        {title}
      </h1>

      <p className="animate-fade-in mb-12 -translate-y-4 text-lg tracking-tight text-balance text-gray-600 opacity-0 md:text-xl dark:text-gray-400">
        {subtitle}
      </p>

      {ctaLabel && (
        <div className="flex justify-center">
          <Button
            asChild
            className="z-20 mt-[-20px] w-fit text-center text-lg tracking-tighter md:w-52"
          >
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
        </div>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-background/80 dark:to-background"
      />
    </section>
  );
}

export function HeroSection() {
  return (
    <Hero
      eyebrow="Trust layer for web agents"
      title="AI agents, under control."
      subtitle="Gate credentials, approvals, browser actions, and receipts for every AI procurement workflow."
      ctaLabel="Start free"
      ctaHref="/register"
    />
  );
}

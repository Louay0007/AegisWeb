"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Cookie, ShieldCheck, X } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

const STORAGE_KEY = "aegisweb-cookie-consent";

export function CookieConsentBar() {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const { contextSafe } = useGSAP(
    () => {
      const accepted = window.localStorage.getItem(STORAGE_KEY);
      if (accepted === "accepted") return;

      setIsVisible(true);

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      gsap.set(barRef.current, {
        autoAlpha: 0,
        y: reduceMotion ? 0 : 28,
        scale: reduceMotion ? 1 : 0.98,
      });
      gsap.to(barRef.current, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: reduceMotion ? 0.01 : 0.72,
        ease: "power3.out",
        delay: reduceMotion ? 0 : 0.65,
      });
    },
    { scope: barRef },
  );

  const close = contextSafe((accepted = false) => {
    if (accepted) {
      window.localStorage.setItem(STORAGE_KEY, "accepted");
      window.dispatchEvent(new Event("aegisweb-cookie-consent"));
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    gsap.to(barRef.current, {
      autoAlpha: 0,
      y: reduceMotion ? 0 : 18,
      scale: reduceMotion ? 1 : 0.98,
      duration: reduceMotion ? 0.01 : 0.28,
      ease: "power2.in",
      onComplete: () => setIsVisible(false),
    });
  });

  if (!isVisible) return null;

  return (
    <div
      ref={barRef}
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-5xl border border-white/15 bg-foreground/92 text-background shadow-[0_24px_90px_rgba(0,0,0,0.26)] backdrop-blur-xl md:inset-x-6 md:bottom-6"
    >
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(255,255,255,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.09),transparent_46%)]" />
        <div className="relative grid gap-5 p-4 sm:p-5 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-6">
          <div className="flex size-11 shrink-0 items-center justify-center border border-background/15 bg-background/10">
            <Cookie className="size-5" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium tracking-tight md:text-base">
                Cookies that keep the gateway reliable.
              </p>
              <span className="inline-flex items-center gap-1 border border-background/15 px-2 py-0.5 text-[0.65rem] uppercase tracking-widest text-background/65">
                <ShieldCheck className="size-3" aria-hidden="true" />
                Privacy-first
              </span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-background/68">
              We use essential cookies for sign-in, security, and product
              analytics that help improve AegisWeb. No ad tracking. You can
              review details in our{" "}
              <Link
                href="/cookies"
                className="underline decoration-background/30 underline-offset-4 transition-colors hover:text-background"
              >
                cookie policy
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row md:justify-end">
            <button
              type="button"
              onClick={() => close(false)}
              className="min-h-10 border border-background/15 px-4 py-2 text-sm font-medium text-background/75 transition-colors hover:bg-background/10 hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              className="min-h-10 bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
            >
              Accept cookies
            </button>
          </div>

          <button
            type="button"
            onClick={() => close(false)}
            className="absolute right-2 top-2 flex size-8 items-center justify-center text-background/55 transition-colors hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70 md:right-3 md:top-3"
            aria-label="Dismiss cookie notice"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type SectionRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: "none" | "short" | "medium";
  as?: "div" | "article" | "li" | "section" | "footer";
  id?: string;
};

const delaySeconds = {
  none: 0,
  short: 0.08,
  medium: 0.16,
};

export function SectionReveal({
  children,
  className = "",
  delay = "none",
  as = "div",
  id,
}: SectionRevealProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const Component = as as ElementType;

  useGSAP(
    () => {
      const element = elementRef.current;
      if (!element) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reduceMotion) {
        gsap.set(element, {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          clearProps: "transform,filter,visibility",
        });
        return;
      }

      gsap.fromTo(
        element,
        {
          autoAlpha: 0,
          y: 48,
          filter: "blur(10px)",
        },
        {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 1.05,
          delay: delaySeconds[delay],
          ease: "power3.out",
          clearProps: "transform,filter,visibility",
          scrollTrigger: {
            trigger: element,
            start: "top 84%",
            once: true,
          },
        },
      );
    },
    { scope: elementRef, dependencies: [delay] },
  );

  return (
    <Component ref={elementRef} className={className} id={id}>
      {children}
    </Component>
  );
}

export function AnimatedSection({
  children,
  className = "",
  id,
  as = "section",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "section" | "footer";
}) {
  return (
    <SectionReveal as={as} id={id} className={className}>
      {children}
    </SectionReveal>
  );
}

export function MotionSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const reduceMotionRef = useRef(false);

  const { contextSafe } = useGSAP(
    () => {
      reduceMotionRef.current = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
    },
    { scope: surfaceRef },
  );

  const handlePointerEnter = contextSafe(() => {
    if (reduceMotionRef.current || !surfaceRef.current) return;
    gsap.to(surfaceRef.current, {
      y: -8,
      scale: 1.01,
      duration: 0.32,
      ease: "power3.out",
      overwrite: "auto",
    });
  });

  const handlePointerLeave = contextSafe(() => {
    if (reduceMotionRef.current || !surfaceRef.current) return;
    gsap.to(surfaceRef.current, {
      y: 0,
      scale: 1,
      duration: 0.42,
      ease: "power3.out",
      overwrite: "auto",
      clearProps: "transform",
    });
  });

  return (
    <div
      ref={surfaceRef}
      className={`${className} will-change-transform`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </div>
  );
}

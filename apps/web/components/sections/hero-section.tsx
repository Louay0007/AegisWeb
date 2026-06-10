"use client";

import Image from "next/image";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const word = "AegisWeb";

const sideImages = [
  {
    src: "/images/hero-side-1.png",
    alt: "Agent identity card inside a controlled web session",
    position: "left",
    span: 1,
  },
  {
    src: "/images/hero-side-2.png",
    alt: "Policy gates for approved agent actions",
    position: "left",
    span: 1,
  },
  {
    src: "/images/hero-side-3.png",
    alt: "Credential vault connected to a browser runtime",
    position: "right",
    span: 1,
  },
  {
    src: "/images/hero-side-4.png",
    alt: "Audit receipt timeline for an agent workflow",
    position: "right",
    span: 1,
  },
];

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const stage = stageRef.current;
      if (!section || !stage) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const letters = gsap.utils.toArray<HTMLElement>(".hero-letter");
      const sideColumns = gsap.utils.toArray<HTMLElement>(".hero-side-column");
      const sideFrames = gsap.utils.toArray<HTMLElement>(".hero-side-frame");

      gsap.set(letters, {
        autoAlpha: 0,
        yPercent: 120,
        rotationX: -18,
        transformOrigin: "50% 100%",
      });
      gsap.set(".hero-main-image", { scale: 1.06, transformOrigin: "50% 50%" });
      gsap.set(sideColumns, { width: "0%", autoAlpha: 0 });
      gsap.set(".hero-left-column", { xPercent: -100 });
      gsap.set(".hero-right-column", { xPercent: 100 });
      gsap.set(sideFrames, { scale: 1.08, autoAlpha: 0 });
      gsap.set(".hero-grid", { gap: 0 });
      gsap.set(".hero-center-panel", { width: "100%" });
      gsap.set([".hero-tagline", ".hero-orbit"], {
        autoAlpha: 0,
        y: 24,
      });

      if (reduceMotion) {
        gsap.set(letters, { autoAlpha: 1, yPercent: 0, rotationX: 0 });
        gsap.set(".hero-main-image", { scale: 1 });
        gsap.set([".hero-tagline", ".hero-orbit"], {
          autoAlpha: 1,
          y: 0,
        });
        return;
      }

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .to(letters, {
          autoAlpha: 1,
          yPercent: 0,
          rotationX: 0,
          duration: 0.9,
          stagger: 0.055,
        })
        .to(".hero-tagline", { autoAlpha: 1, y: 0, duration: 0.8 }, "-=0.45")
        .to(".hero-orbit", { autoAlpha: 1, y: 0, duration: 0.9 }, "-=0.55")
        .to(
          ".hero-main-image",
          { scale: 1, duration: 1.4, ease: "power2.out" },
          0.2,
        );

      gsap.to(".hero-orbit", {
        rotation: 360,
        duration: 28,
        ease: "none",
        repeat: -1,
      });

      const scrollTl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=220%",
          scrub: 0.85,
          pin: stage,
          anticipatePin: 1,
        },
      });

      scrollTl
        .to(
          [".hero-title-wrap", ".hero-tagline", ".hero-orbit"],
          { autoAlpha: 0, y: -36, duration: 0.18 },
          0,
        )
        .to(".hero-main-image", { scale: 1.025, duration: 0.45 }, 0)
        .to(".hero-grid", { gap: 8, duration: 0.72 }, 0.16)
        .to(".hero-center-panel", { width: "20%", duration: 0.78 }, 0.18)
        .to(sideColumns, { width: "40%", autoAlpha: 1, duration: 0.78 }, 0.18)
        .to(
          ".hero-left-column",
          { xPercent: 0, yPercent: -15, duration: 0.78 },
          0.18,
        )
        .to(
          ".hero-right-column",
          { xPercent: 0, yPercent: -15, duration: 0.78 },
          0.18,
        )
        .to(
          sideFrames,
          { autoAlpha: 1, scale: 1, duration: 0.55, stagger: 0.035 },
          0.25,
        )
        .to(".hero-image-shade", { autoAlpha: 0.42, duration: 0.6 }, 0.24);
    },
    { scope: sectionRef },
  );

  return (
    <section id="hero" ref={sectionRef} className="relative bg-background">
      <div
        ref={stageRef}
        className="relative h-screen overflow-hidden bg-background"
      >
        <div className="hero-grid relative flex h-full w-full items-stretch justify-center">
          <div className="hero-side-column hero-left-column flex h-full flex-row gap-2 overflow-hidden will-change-transform">
            {sideImages
              .filter((img) => img.position === "left")
              .map((img, idx) => (
                <div
                  key={idx}
                  className="hero-side-frame relative h-full flex-1 overflow-hidden will-change-transform"
                >
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    className="object-cover"
                    sizes="40vw"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-black/10" />
                </div>
              ))}
          </div>

          <div className="hero-center-panel relative h-full flex-none overflow-hidden will-change-transform">
            <div className="hero-title-wrap absolute inset-0 z-20 flex items-center justify-center perspective-distant">
              <h1 className="whitespace-nowrap text-[clamp(6rem,22vw,24rem)] font-bold leading-[0.82] tracking-tighter text-black">
                {word.split("").map((letter, index) => (
                  <span
                    key={index}
                    className="hero-letter inline-block will-change-transform"
                  >
                    {letter}
                  </span>
                ))}
              </h1>
            </div>

            <Image
              src="/images/hero-mono.png"
              alt="AegisWeb control gateway for permissioned AI agent actions"
              fill
              className="hero-main-image absolute inset-0 z-10 object-cover will-change-transform"
              priority
              sizes="100vw"
            />
            <div className="hero-image-shade absolute inset-0 z-10 bg-black opacity-0" />
          </div>

          <div className="hero-side-column hero-right-column flex h-full flex-row gap-2 overflow-hidden will-change-transform">
            {sideImages
              .filter((img) => img.position === "right")
              .map((img, idx) => (
                <div
                  key={idx}
                  className="hero-side-frame relative h-full flex-1 overflow-hidden will-change-transform"
                >
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    className="object-cover"
                    sizes="40vw"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-black/10" />
                </div>
              ))}
          </div>
        </div>

        <div className="hero-orbit pointer-events-none absolute left-1/2 top-1/2 z-30 h-[min(72vw,720px)] w-[min(72vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20">
          <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_32px_rgba(255,255,255,0.9)]" />
          <span className="absolute bottom-10 right-14 h-1.5 w-1.5 rounded-full bg-white/70" />
        </div>

        <div className="hero-tagline pointer-events-none absolute bottom-0 left-0 right-0 z-30 px-6 pb-12 md:px-12 md:pb-16 lg:px-20 lg:pb-20">
          <p className="mx-auto max-w-2xl text-center text-2xl leading-relaxed text-white md:text-3xl lg:text-[2.5rem] lg:leading-snug">
            Identity, permissions
            <br />
            and receipts for web agents.
          </p>
        </div>
      </div>
    </section>
  );
}

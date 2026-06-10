"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { BrandLogo } from "@/components/brand/brand-logo";

gsap.registerPlugin(useGSAP);

const navLinks = [
  { label: "Platform", href: "#developers" },
  { label: "Proof", href: "#proof" },
  { label: "Workflows", href: "#workflows" },
  { label: "Security", href: "#security" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion) return;

      gsap.fromTo(
        headerRef.current,
        { autoAlpha: 0, y: -24, scale: 0.98 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          ease: "power3.out",
          delay: 0.15,
        },
      );
    },
    { scope: headerRef },
  );

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion || !isMenuOpen) return;

      gsap.fromTo(
        ".mobile-menu-panel",
        { autoAlpha: 0, y: -12, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: "power3.out" },
      );
      gsap.fromTo(
        ".mobile-menu-link",
        { autoAlpha: 0, x: -12 },
        {
          autoAlpha: 1,
          x: 0,
          duration: 0.28,
          stagger: 0.045,
          ease: "power2.out",
        },
      );
    },
    { scope: headerRef, dependencies: [isMenuOpen] },
  );

  return (
    <header
      ref={headerRef}
      className={`fixed inset-x-0 top-4 z-50 mx-auto w-[calc(100%-2rem)] max-w-3xl transition-all duration-300 ${isScrolled ? "bg-background/80 backdrop-blur-md rounded-full" : "bg-transparent"}`}
      style={{
        boxShadow: isScrolled
          ? "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px"
          : "none",
      }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-2 py-2 pl-4 transition-all duration-300 sm:pl-5">
        {/* Logo */}
        <Link
          href="#hero"
          className="inline-flex min-h-10 items-center justify-self-start transition-opacity duration-300 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="AegisWeb home"
        >
          <BrandLogo variant="primary" className="h-9 w-40" priority />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center justify-center gap-10 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm transition-colors text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden items-center justify-self-end md:flex">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium transition-all rounded-full bg-foreground text-background hover:opacity-80"
          >
            Sign in
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="col-start-3 justify-self-end transition-colors text-foreground md:hidden"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="mobile-menu-panel border-t border-border bg-background px-6 py-8 md:hidden rounded-b-2xl">
          <nav className="flex flex-col gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="mobile-menu-link text-lg text-foreground"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="mobile-menu-link mt-4 bg-foreground px-5 py-3 text-center text-sm font-medium text-background rounded-full"
              onClick={() => setIsMenuOpen(false)}
            >
              Sign in
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

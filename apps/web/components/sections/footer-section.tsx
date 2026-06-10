"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/section-reveal";

const footerLinks = {
  explore: [
    { label: "Principles", href: "#principles" },
    { label: "Workflows", href: "#workflows" },
    { label: "Pricing", href: "#pricing" },
    { label: "Proof", href: "#proof" },
  ],
  company: [
    { label: "Security", href: "/security" },
    { label: "Platform", href: "#developers" },
    { label: "Questions", href: "#faq" },
    { label: "Acceptable use", href: "/acceptable-use" },
  ],
  platform: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Cookies", href: "/cookies" },
    { label: "Audit exports", href: "#proof" },
  ],
};

export function FooterSection() {
  return (
    <AnimatedSection as="footer" className="bg-background">
      {/* Main Footer Content */}
      <div className="border-t border-border px-6 py-16 md:px-12 md:py-20 lg:px-20">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 lg:col-span-2">
            <Link href="#hero" className="text-lg font-semibold tracking-tight text-foreground">
              AegisWeb
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The permission, approval, credential, and audit layer for AI
              agents acting on the web.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">
              Explore
            </h4>
            <ul className="space-y-3">
              {footerLinks.explore.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">
              Company
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">
              Platform
            </h4>
            <ul className="space-y-3">
              {footerLinks.platform.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border px-6 py-6 md:px-12 lg:px-20">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-xs text-muted-foreground">
            2026 AegisWeb. All rights reserved.
          </p>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms
            </Link>
            <Link
              href="/cookies"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

"use client";

import { usePathname } from "next/navigation";

export function FeedbackWidget() {
  const pathname = usePathname();
  const subject = encodeURIComponent("AegisWeb pilot feedback");
  const body = encodeURIComponent(`Page: ${pathname}\n\nWhat happened?\n\nWhat did you expect?\n`);
  return (
    <a
      href={`mailto:support@aegisweb.com?subject=${subject}&body=${body}`}
      className="fixed bottom-4 right-4 z-40 border border-border bg-foreground px-4 py-2 text-sm font-medium text-background shadow-[0_16px_44px_rgba(0,0,0,0.22)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Send feedback
    </a>
  );
}

"use client";

import { useState, type ReactNode } from "react";

import { StepUpDialog } from "@/components/auth/step-up-dialog";

export function StepUpGuard({ children, onVerified }: { children: (request: () => void) => ReactNode; onVerified: (token: string) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {children(() => setOpen(true))}
      <StepUpDialog open={open} onCancel={() => setOpen(false)} onVerified={(token) => { setOpen(false); void onVerified(token); }} />
    </>
  );
}

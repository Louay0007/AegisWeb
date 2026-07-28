"use client";

import { useCallback, useRef, useState } from "react";

import { StepUpDialog } from "@/components/auth/step-up-dialog";

type PendingStepUp = {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
};

/**
 * Promise-based step-up helper for sensitive mutations.
 * Opens the confirmation dialog and resolves with a short-lived token.
 */
export function useStepUp() {
  const pendingRef = useRef<PendingStepUp | null>(null);
  const [open, setOpen] = useState(false);

  const requestStepUp = useCallback(() => {
    return new Promise<string>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      setOpen(true);
    });
  }, []);

  const cancel = useCallback(() => {
    pendingRef.current?.reject(new Error("Step-up confirmation was cancelled."));
    pendingRef.current = null;
    setOpen(false);
  }, []);

  const verified = useCallback((token: string) => {
    pendingRef.current?.resolve(token);
    pendingRef.current = null;
    setOpen(false);
  }, []);

  const dialog = (
    <StepUpDialog open={open} onCancel={cancel} onVerified={verified} />
  );

  return { requestStepUp, dialog };
}

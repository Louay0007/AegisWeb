import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailStatus } from "@/components/auth/verify-email-status";

export const metadata: Metadata = {
  title: "Verify email | AegisWeb",
  description: "Verify your AegisWeb email address.",
};

export default function VerifyEmailPage() {
  return (
    <AuthShell eyebrow="Email verification" title="Confirm the person behind the workspace.">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading verification link...</p>}>
        <VerifyEmailStatus />
      </Suspense>
    </AuthShell>
  );
}

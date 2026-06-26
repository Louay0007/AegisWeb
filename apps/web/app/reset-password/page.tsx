import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set password | AegisWeb",
  description: "Set a new password for your AegisWeb account.",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell eyebrow="Account recovery" title="Set a clean key for the gateway.">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading reset link...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}

import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset password | AegisWeb",
  description: "Request an AegisWeb password reset link.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell eyebrow="Account recovery" title="Recover control without weakening the gate.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}

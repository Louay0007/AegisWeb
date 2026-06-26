import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in | AegisWeb",
  description: "Sign in to the AegisWeb control gateway.",
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Control gateway"
      title="Let agents work, but never without authority."
    >
      <LoginForm />
    </AuthShell>
  );
}

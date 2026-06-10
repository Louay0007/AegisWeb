import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create workspace | AegisWeb",
  description: "Create an AegisWeb workspace for governed AI web agents.",
};

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Workspace setup"
      title="Start with a gate, not a password leak."
      description="Create the first organization owner, then bring SaaS agent work under policy, approval, vault, and audit control."
    >
      <RegisterForm />
    </AuthShell>
  );
}

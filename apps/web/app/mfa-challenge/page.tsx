import { Suspense } from "react";
import { MfaChallenge } from "@/components/auth/mfa-challenge";
import { AuthShell } from "@/components/auth/auth-shell";

export default function Page() {
  return (
    <AuthShell eyebrow="Multi-factor" title="One more check before the gateway opens.">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading verification...</div>}>
        <MfaChallenge />
      </Suspense>
    </AuthShell>
  );
}

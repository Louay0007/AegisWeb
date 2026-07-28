"use client";

import { MfaSetup } from "@/components/auth/mfa-setup";
import { PageHeader } from "@/components/app-shell/page-header";
import { ActiveSessions } from "@/components/settings/active-sessions";
import { useAuthSession } from "@/lib/auth/auth-session";

export default function Page() {
  const { state } = useAuthSession();
  const user = state.status === "authenticated" ? state.session.user : null;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Security" title="Account security" description="Configure MFA and recovery options for your AegisWeb account." />
      <MfaSetup enabled={user?.mfaEnabled} />
      <ActiveSessions />
      <section className="grid gap-4 md:grid-cols-2">
        <div className="border border-border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">API keys</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Public API keys are deferred to a later phase. Use the dashboard and authenticated BFF session for now.
          </p>
        </div>
        <div className="border border-border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Webhooks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Outbound webhooks are deferred. Approvals and run events are available in the dashboard and email notifications.
          </p>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { RefreshCircle } from "iconoir-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { PaginationControls } from "@/components/data/pagination-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { HelpTooltip } from "@/components/support/help-tooltip";
import { apiGet, apiPatch, apiPost } from "@/lib/api/api-client";
import { authErrorMessage, useAuthSession } from "@/lib/auth/auth-session";
import { useStepUp } from "@/hooks/use-step-up";

type Organization = {
  id: string;
  name: string;
  domain: string;
  plan: string;
  billingEmail: string | null;
};

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt?: string | null;
  emailVerifiedAt?: string | null;
};

type NotificationPreferences = {
  approvalRequests: boolean;
  runCompletions: boolean;
  failures: boolean;
};

type BillingStatus = {
  provider: string;
  configured: boolean;
  mode: "test" | "live" | "disabled";
  plan: string;
  billingEmail: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  priceId: string | null;
  plans: { starter: boolean; business: boolean };
  message: string;
};

type BillingSession = {
  id: string;
  url: string | null;
};

const ROLES = ["owner", "admin", "approver", "auditor", "developer"];

export function ProductSettingsPage() {
  const { state, refresh } = useAuthSession();
  const currentUser = state.status === "authenticated" || state.status === "demo" ? state.session.user : null;
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [status, setStatus] = useState("Loading settings...");
  const [error, setError] = useState("");
  const { requestStepUp, dialog: stepUpDialog } = useStepUp();

  async function load() {
    setError("");
    setStatus("Loading settings...");
    try {
      const [org, members, notifications, billingStatus] = await Promise.all([
        apiGet<Organization>("/organization"),
        apiGet<User[]>("/users?limit=100"),
        apiGet<NotificationPreferences>("/user/preferences/notifications"),
        apiGet<BillingStatus>("/billing"),
      ]);
      setOrganization(org);
      setUsers(members);
      setPrefs(notifications);
      setBilling(billingStatus);
      setStatus("");
    } catch (apiError) {
      setError(authErrorMessage(apiError));
      setStatus("");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    setError("");
    try {
      const stepUpToken = await requestStepUp();
      const updated = await apiPatch<Organization>(
        "/organization",
        {
          name: organization.name,
          domain: organization.domain,
          billingEmail: organization.billingEmail || null,
        },
        { stepUpToken },
      );
      setOrganization(updated);
      setStatus("Organization saved.");
    } catch (apiError) {
      setError(authErrorMessage(apiError));
    }
  }

  async function inviteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setStatus("");
    try {
      const result = await apiPost<User & { inviteEmailDelivered?: boolean; inviteEmailWarning?: string | null }>(
        "/users/invite",
        {
          email: String(form.get("email") ?? ""),
          name: String(form.get("name") ?? ""),
          role: String(form.get("role") ?? "developer"),
        },
      );
      event.currentTarget.reset();
      const deliveryMessage =
        result.inviteEmailDelivered === false
          ? result.inviteEmailWarning
            ? `User invited, but email was not delivered: ${result.inviteEmailWarning}`
            : "User invited, but the invitation email was not delivered."
          : "Invitation sent.";
      await load();
      setStatus(deliveryMessage);
    } catch (apiError) {
      setError(authErrorMessage(apiError));
    }
  }

  async function changeRole(user: User, role: string) {
    if (!window.confirm(`Change ${user.email} to ${role}?`)) return;
    await apiPatch(`/users/${user.id}/role`, { role });
    await load();
  }

  async function setUserEnabled(user: User, enabled: boolean) {
    if (!window.confirm(`${enabled ? "Enable" : "Disable"} ${user.email}?`)) return;
    await apiPost(`/users/${user.id}/${enabled ? "enable" : "disable"}`, {});
    await load();
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiPatch("/users/me", { name: String(form.get("name") ?? "") });
    await refresh();
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiPatch("/users/me/password", {
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword: String(form.get("newPassword") ?? ""),
    });
    event.currentTarget.reset();
  }

  async function saveNotifications(next: NotificationPreferences) {
    setPrefs(next);
    setPrefs(await apiPatch<NotificationPreferences>("/user/preferences/notifications", next));
  }

  async function openCheckout(plan: "starter" | "business") {
    setError("");
    try {
      const session = await apiPost<BillingSession>("/billing/create-checkout", { plan });
      if (session.url) window.location.href = session.url;
    } catch (apiError) {
      setError(authErrorMessage(apiError));
    }
  }

  async function openBillingPortal() {
    setError("");
    try {
      const session = await apiPost<BillingSession>("/billing/portal", {});
      if (session.url) window.location.href = session.url;
    } catch (apiError) {
      setError(authErrorMessage(apiError));
    }
  }

  return (
    <div className="space-y-6">
      {stepUpDialog}
      <PageHeader eyebrow="Workspace" title="Settings" description="Complete the workspace profile, members, account security, and notifications." />
      {status ? <p className="text-sm text-muted-foreground" role="status">{status}</p> : null}
      {error ? <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
      {currentUser?.emailVerifiedAt ? null : <EmailVerificationBanner />}

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={saveOrganization} className="border border-border bg-card p-5 shadow-sm">
          <PanelTitle title="Organization profile" description="Owners can update workspace identity and billing contact." help="Billing email is the operational contact for pilot conversion and support follow-up." />
          <div className="mt-5 grid gap-4">
            <Field label="Organization name" value={organization?.name ?? ""} onChange={(value) => setOrganization((org) => org ? { ...org, name: value } : org)} />
            <Field label="Slug / domain" value={organization?.domain ?? ""} onChange={(value) => setOrganization((org) => org ? { ...org, domain: value } : org)} />
            <Field label="Billing email" value={organization?.billingEmail ?? ""} onChange={(value) => setOrganization((org) => org ? { ...org, billingEmail: value } : org)} />
            <div className="flex items-center justify-between border border-border bg-muted/35 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium uppercase">{organization?.plan ?? "local"}</span>
            </div>
            <Button type="submit" className="justify-self-start">Save organization</Button>
          </div>
        </form>

        <section className="border border-border bg-card p-5 shadow-sm">
          <PanelTitle title="Your profile" description="Keep your account name and password current." help="Password changes revoke active refresh sessions so stale browsers cannot continue." />
          <form onSubmit={saveProfile} className="mt-5 flex gap-2">
            <Input name="name" defaultValue={currentUser?.name ?? ""} aria-label="Name" />
            <Button type="submit">Save name</Button>
          </form>
          <form onSubmit={changePassword} className="mt-4 grid gap-2">
            <Input name="currentPassword" type="password" placeholder="Current password" autoComplete="current-password" />
            <Input name="newPassword" type="password" placeholder="New password" autoComplete="new-password" />
            <Button type="submit" variant="outline" className="justify-self-start">Change password</Button>
          </form>
          <Button asChild variant="link" className="mt-3 px-0">
            <Link href="/app/settings/security">Manage MFA and sessions</Link>
          </Button>
        </section>
      </section>

      {billing ? (
        <BillingPanel
          billing={billing}
          onCheckout={openCheckout}
          onPortal={openBillingPortal}
        />
      ) : null}

      <section className="border border-border bg-card p-5 shadow-sm">
        <PanelTitle title="User management" description="Invite teammates, change roles, and disable stale accounts." help="Invited users receive a setup link and remain invited until they set a password." />
        <form onSubmit={inviteUser} className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
          <Input name="name" placeholder="Name" required />
          <Input name="email" type="email" placeholder="teammate@company.com" required />
          <select name="role" className="border border-input bg-background px-3 py-2 text-sm" defaultValue="developer">
            {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <Button type="submit">Send invite</Button>
        </form>
        <div className="mt-5 overflow-x-auto border border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/45 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <tr><th className="px-3 py-2">User</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Last login</th><th className="px-3 py-2">Actions</th></tr>
            </thead>
            <tbody>
              {(() => {
                const limit = 20;
                const start = (userPage - 1) * limit;
                const displayed = users.slice(start, start + limit);
                return displayed.map((user) => (
                  <tr key={user.id} className="border-t border-border">
                    <td className="px-3 py-3"><div className="font-medium">{user.name}</div><div className="text-muted-foreground">{user.email}</div></td>
                    <td className="px-3 py-3">
                      <Select value={user.role} onValueChange={(role) => void changeRole(user, role)}>
                        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3 uppercase">{user.status}</td>
                    <td className="px-3 py-3 text-muted-foreground">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</td>
                    <td className="px-3 py-3"><Button type="button" variant="outline" onClick={() => void setUserEnabled(user, user.status === "disabled")}>{user.status === "disabled" ? "Enable" : "Disable"}</Button></td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
          {users.length > 20 ? (
            <div className="border-t border-border">
              <PaginationControls
                page={userPage}
                pageCount={Math.max(1, Math.ceil(users.length / 20))}
                total={users.length}
                onPrevious={userPage > 1 ? () => setUserPage(userPage - 1) : undefined}
                onNext={userPage < Math.max(1, Math.ceil(users.length / 20)) ? () => setUserPage(userPage + 1) : undefined}
                onPageChange={setUserPage}
              />
            </div>
          ) : null}
        </div>
      </section>

      {prefs ? <NotificationPanel prefs={prefs} onChange={(next) => void saveNotifications(next)} /> : null}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function PanelTitle({ title, description, help }: { title: string; description: string; help?: string }) {
  return <div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold tracking-[-0.015em]">{title}</h2>{help ? <HelpTooltip label={`${title} help`}>{help}</HelpTooltip> : null}</div><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}

function BillingPanel({
  billing,
  onCheckout,
  onPortal,
}: {
  billing: BillingStatus;
  onCheckout: (plan: "starter" | "business") => Promise<void>;
  onPortal: () => Promise<void>;
}) {
  return (
    <section className="border border-border bg-card p-5 shadow-sm">
      <PanelTitle
        title="Billing"
        description="Start or manage a Stripe subscription for this workspace."
        help="Use Stripe test mode for staging. Switch to live keys only after the checkout and webhook flow is verified."
      />
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <BillingFact label="Provider" value={`${billing.provider} / ${billing.mode}`} />
        <BillingFact label="Plan" value={billing.plan} />
        <BillingFact label="Subscription" value={billing.subscriptionStatus ?? "not started"} />
        <BillingFact label="Configured" value={billing.configured ? "yes" : "no"} />
      </div>
      {!billing.configured ? (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
          Stripe keys or price IDs are missing. Add them to the API environment before enabling paid checkout.
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={!billing.configured || !billing.plans.starter}
          onClick={() => void onCheckout("starter")}
        >
          Start Starter
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!billing.configured || !billing.plans.business}
          onClick={() => void onCheckout("business")}
        >
          Start Business
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!billing.customerId}
          onClick={() => void onPortal()}
        >
          Open Stripe portal
        </Button>
      </div>
    </section>
  );
}

function BillingFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-muted/30 px-3 py-2 text-sm">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function EmailVerificationBanner() {
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  return (
    <div className="flex flex-col justify-between gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100 md:flex-row md:items-center">
      <span>Verify your email to unlock full production access and recovery flows.</span>
      <Button type="button" variant="outline" disabled={status !== "idle"} onClick={async () => { setStatus("loading"); await apiPost("/auth/resend-verification", {}); setStatus("sent"); }}>
        {status === "loading" ? <RefreshCircle className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}{status === "sent" ? "Sent" : "Resend verification"}
      </Button>
    </div>
  );
}

function NotificationPanel({ prefs, onChange }: { prefs: NotificationPreferences; onChange: (prefs: NotificationPreferences) => void }) {
  return (
    <section className="border border-border bg-card p-5 shadow-sm">
      <PanelTitle title="Notification preferences" description="Choose which email events should interrupt you." help="Approval notifications should stay enabled for active pilot approvers." />
      <div className="mt-5 grid gap-4">
        <ToggleRow label="Approval requests" checked={prefs.approvalRequests} onCheckedChange={(value) => onChange({ ...prefs, approvalRequests: value })} />
        <ToggleRow label="Run completions" checked={prefs.runCompletions} onCheckedChange={(value) => onChange({ ...prefs, runCompletions: value })} />
        <ToggleRow label="Failures" checked={prefs.failures} onCheckedChange={(value) => onChange({ ...prefs, failures: value })} />
        <p className="text-sm text-muted-foreground">
          Approvals are delivered by dashboard and email in this release. Slack notifications are deferred to a later phase.
        </p>
      </div>
    </section>
  );
}

function ToggleRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between border border-border px-3 py-3"><span className="text-sm font-medium">{label}</span><Switch checked={checked} onCheckedChange={onCheckedChange} /></div>;
}

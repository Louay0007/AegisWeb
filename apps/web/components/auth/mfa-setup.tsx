"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api/api-client";
import { authErrorMessage, useAuthSession } from "@/lib/auth/auth-session";

type EnrollResponse = { secret: string; otpauthUrl: string; qrCodeDataUrl: string };

export function MfaSetup({ enabled }: { enabled?: boolean }) {
  const { refresh } = useAuthSession();
  const [enrollment, setEnrollment] = useState<EnrollResponse | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function enroll() {
    setError("");
    setStatus("");
    try {
      setEnrollment(await apiPost<EnrollResponse>("/auth/mfa/enroll", {}));
    } catch (enrollError) {
      setError(authErrorMessage(enrollError));
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const result = await apiPost<{ mfaEnabled: true; backupCodes: string[] }>("/auth/mfa/verify", { code });
      setBackupCodes(result.backupCodes);
      await refresh();
    } catch (verifyError) {
      setError(authErrorMessage(verifyError));
    }
  }

  async function disable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    try {
      await apiPost("/auth/mfa/disable", { code: disableCode });
      setDisabling(false);
      setDisableCode("");
      setEnrollment(null);
      setStatus("MFA disabled for your account.");
      await refresh();
    } catch (disableError) {
      setError(authErrorMessage(disableError));
    }
  }

  if (backupCodes.length) {
    return (
      <div className="rounded-lg border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">Save your backup codes</h2>
        <p className="mt-2 text-sm text-muted-foreground">These codes are shown once. Store them somewhere safe.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {backupCodes.map((backupCode) => (
            <code key={backupCode} className="border border-border bg-muted p-2 text-sm">
              {backupCode}
            </code>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-6">
      <h2 className="text-lg font-semibold">Multi-factor authentication</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {enabled
          ? "MFA is active for your account."
          : "Protect your account with an authenticator app."}
      </p>
      {!enrollment ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={enroll}>{enabled ? "Re-enroll MFA" : "Enable MFA"}</Button>
          {enabled ? (
            <Button type="button" variant="outline" onClick={() => setDisabling((value) => !value)}>
              {disabling ? "Cancel disable" : "Disable MFA"}
            </Button>
          ) : null}
        </div>
      ) : null}
      {enrollment ? (
        <form onSubmit={verify} className="mt-5 space-y-4">
          <img src={enrollment.qrCodeDataUrl} alt="MFA QR code" className="size-48 border border-border bg-white p-2" />
          <p className="break-all text-xs text-muted-foreground">Manual setup key: {enrollment.secret}</p>
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Verification code</Label>
            <Input id="mfa-code" value={code} onChange={(event) => setCode(event.target.value)} required />
          </div>
          <Button>Verify and enable</Button>
        </form>
      ) : null}
      {disabling && enabled && !enrollment ? (
        <form onSubmit={disable} className="mt-5 space-y-4 border-t border-border pt-5">
          <p className="text-sm text-muted-foreground">
            Enter a current authenticator code to disable MFA on this account.
          </p>
          <div className="space-y-2">
            <Label htmlFor="mfa-disable-code">Authenticator code</Label>
            <Input
              id="mfa-disable-code"
              value={disableCode}
              onChange={(event) => setDisableCode(event.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="destructive">
            Confirm disable
          </Button>
        </form>
      ) : null}
      {status ? <p className="mt-4 border border-border bg-muted/40 px-3 py-2 text-sm" role="status">{status}</p> : null}
      {error ? <p className="mt-4 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

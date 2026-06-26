"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api/api-client";
import { authErrorMessage } from "@/lib/auth/auth-session";

type EnrollResponse = { secret: string; otpauthUrl: string; qrCodeDataUrl: string };

export function MfaSetup({ enabled }: { enabled?: boolean }) {
  const [enrollment, setEnrollment] = useState<EnrollResponse | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function enroll() {
    setError("");
    try { setEnrollment(await apiPost<EnrollResponse>("/auth/mfa/enroll", {})); }
    catch (enrollError) { setError(authErrorMessage(enrollError)); }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const result = await apiPost<{ mfaEnabled: true; backupCodes: string[] }>("/auth/mfa/verify", { code });
      setBackupCodes(result.backupCodes);
    } catch (verifyError) { setError(authErrorMessage(verifyError)); }
  }

  if (backupCodes.length) {
    return (
      <div className="rounded-lg border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">Save your backup codes</h2>
        <p className="mt-2 text-sm text-muted-foreground">These codes are shown once. Store them somewhere safe.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{backupCodes.map((backupCode) => <code key={backupCode} className="border border-border bg-muted p-2 text-sm">{backupCode}</code>)}</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-6">
      <h2 className="text-lg font-semibold">Multi-factor authentication</h2>
      <p className="mt-2 text-sm text-muted-foreground">{enabled ? "MFA is active for your account." : "Protect your account with an authenticator app."}</p>
      {!enrollment ? <Button className="mt-4" onClick={enroll}>{enabled ? "Re-enroll MFA" : "Enable MFA"}</Button> : null}
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
      {error ? <p className="mt-4 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api/api-client";
import { authErrorMessage, type AuthUser, useAuthSession } from "@/lib/auth/auth-session";

export function MfaChallenge() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { saveApiSession } = useAuthSession();
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const tempToken = searchParams.get("token") ?? "";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = useRecovery
        ? await apiPost<{ user: AuthUser }>("/auth/mfa/recovery", { tempToken, backupCode })
        : await apiPost<{ user: AuthUser }>("/auth/mfa/challenge", { tempToken, code });
      saveApiSession({ mode: "api", user: data.user });
      router.push("/app/home");
    } catch (challengeError) {
      setError(authErrorMessage(challengeError));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">Verify your sign-in</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter your authenticator code to continue.</p>
      </div>
      {useRecovery ? (
        <div className="space-y-2">
          <Label htmlFor="backupCode">Backup code</Label>
          <Input id="backupCode" value={backupCode} onChange={(event) => setBackupCode(event.target.value)} required />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="code">Authenticator code</Label>
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required />
        </div>
      )}
      {error ? <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <Button className="w-full" disabled={loading || !tempToken}>{loading ? "Verifying..." : "Continue"}</Button>
      <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setUseRecovery((value) => !value)}>
        {useRecovery ? "Use authenticator code" : "Use a backup code"}
      </button>
    </form>
  );
}

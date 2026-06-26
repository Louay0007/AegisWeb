"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api/api-client";
import { authErrorMessage } from "@/lib/auth/auth-session";

export function StepUpDialog({ open, onCancel, onVerified }: { open: boolean; onCancel: () => void; onVerified: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  if (!open) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const result = await apiPost<{ stepUpToken: string }>("/auth/step-up", { password: password || undefined, totpCode: totpCode || undefined });
      onVerified(result.stepUpToken);
    } catch (stepUpError) {
      setError(authErrorMessage(stepUpError));
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Confirm sensitive action</h2>
        <p className="mt-2 text-sm text-muted-foreground">Re-authenticate with your password or authenticator code.</p>
        <div className="mt-4 space-y-2"><Label htmlFor="step-password">Password</Label><Input id="step-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <div className="mt-4 space-y-2"><Label htmlFor="step-totp">Authenticator code</Label><Input id="step-totp" value={totpCode} onChange={(event) => setTotpCode(event.target.value)} /></div>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button>Continue</Button></div>
      </form>
    </div>
  );
}

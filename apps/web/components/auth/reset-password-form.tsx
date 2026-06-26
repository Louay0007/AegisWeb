"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Key, RefreshCircle } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api/api-client";
import { authErrorMessage } from "@/lib/auth/auth-session";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setStatus("loading");
    try {
      await apiPost<{ ok: true }>("/auth/reset-password", { token, password });
      setStatus("done");
    } catch (apiError) {
      setError(authErrorMessage(apiError));
      setStatus("idle");
    }
  }

  if (!token) {
    return <AuthLinkError message="Reset link is missing a token." />;
  }

  if (status === "done") {
    return <AuthSuccess title="Password updated" description="Use your new password to sign in." />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.025em]">Choose a new password</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">This also accepts pending invitations and revokes old sessions.</p>
      </div>
      <PasswordField id="password" label="New password" value={password} onChange={setPassword} />
      <PasswordField id="confirm" label="Confirm password" value={confirm} onChange={setConfirm} />
      {error ? <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
      <Button type="submit" className="h-12 w-full justify-between" disabled={status === "loading"}>
        <span>Set password</span>
        {status === "loading" ? <RefreshCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
      </Button>
    </form>
  );
}

function PasswordField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Key className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id={id} type="password" minLength={8} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 pl-11" required />
      </div>
    </div>
  );
}

function AuthSuccess({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.025em]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <Button asChild className="h-12 w-full">
        <Link href="/login">Go to sign in</Link>
      </Button>
    </div>
  );
}

function AuthLinkError({ message }: { message: string }) {
  return (
    <div className="space-y-5">
      <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{message}</p>
      <Button asChild variant="outline" className="h-12 w-full">
        <Link href="/forgot-password">Request a new link</Link>
      </Button>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Mail, RefreshCircle } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api/api-client";
import { authErrorMessage } from "@/lib/auth/auth-session";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("loading");
    try {
      await apiPost<{ ok: true }>("/auth/forgot-password", { email });
      setStatus("sent");
    } catch (apiError) {
      setError(authErrorMessage(apiError));
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.025em]">Reset your password</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Enter your work email and we will send a link if the account exists.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 pl-11" required />
        </div>
      </div>
      {error ? <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
      {status === "sent" ? (
        <p className="border border-border bg-muted/40 px-3 py-2 text-sm leading-6" role="status">
          Check your inbox for a reset link. It expires soon for security.
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full justify-between" disabled={status === "loading" || status === "sent"}>
        <span>Send reset link</span>
        {status === "loading" ? <RefreshCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
      </Button>
      <Link href="/login" className="block text-center text-sm font-medium text-muted-foreground hover:text-foreground">
        Back to sign in
      </Link>
    </form>
  );
}

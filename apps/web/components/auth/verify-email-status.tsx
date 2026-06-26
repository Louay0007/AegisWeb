"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api/api-client";
import { authErrorMessage } from "@/lib/auth/auth-session";

export function VerifyEmailStatus() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setMessage("Verification link is missing a token.");
      setState("error");
      return;
    }
    apiGet<{ ok: true }>(`/auth/verify?token=${encodeURIComponent(token)}`)
      .then(() => setState("done"))
      .catch((error) => {
        setMessage(authErrorMessage(error));
        setState("error");
      });
  }, [token]);

  if (state === "loading") {
    return <p className="text-sm text-muted-foreground" role="status">Verifying your email...</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.025em]">{state === "done" ? "Email verified" : "Verification failed"}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {state === "done" ? "Your workspace access is fully verified." : message}
        </p>
      </div>
      <Button asChild className="h-12 w-full">
        <Link href="/app/home">Continue to dashboard</Link>
      </Button>
    </div>
  );
}

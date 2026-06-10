"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Fingerprint,
  Eye,
  EyeClosed,
  IconoirProvider,
  Lock,
  Mail,
  RefreshCircle,
} from "iconoir-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuthSession, authErrorMessage } from "@/lib/auth/auth-session";
import { isDemoModeEnabled } from "@/lib/runtime-config";

import { DEMO_PASSWORD, DEMO_USERS, demoSessionFor } from "./auth-client";

gsap.registerPlugin(useGSAP);

export function LoginForm() {
  const router = useRouter();
  const { signIn, saveDemoSession } = useAuthSession();
  const formRef = useRef<HTMLDivElement | null>(null);
  const demoEnabled = isDemoModeEnabled();
  const [email, setEmail] = useState(demoEnabled ? DEMO_USERS[0].email : "");
  const [password, setPassword] = useState(demoEnabled ? DEMO_PASSWORD : "");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");

  const { contextSafe } = useGSAP(
    () => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion) {
        gsap.set(".login-reveal", {
          autoAlpha: 1,
          y: 0,
          clearProps: "transform,visibility",
        });
        return;
      }

      gsap.fromTo(
        ".login-reveal",
        { autoAlpha: 0, y: 22, filter: "blur(8px)" },
        {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.72,
          ease: "power3.out",
          stagger: 0.055,
          clearProps: "transform,filter,visibility",
        },
      );
    },
    { scope: formRef },
  );

  const pulseIcon = contextSafe(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    gsap.fromTo(
      ".login-mark",
      { scale: 0.94, rotation: -3 },
      {
        scale: 1,
        rotation: 0,
        duration: 0.42,
        ease: "back.out(2)",
        overwrite: "auto",
      },
    );
  });

  async function submitLogin() {
    setError("");
    setStatus("loading");

    try {
      await signIn(email, password);
      router.push("/app/home");
    } catch (apiError) {
      const fallback =
        demoEnabled && password === DEMO_PASSWORD
          ? demoSessionFor(email)
          : null;

      if (fallback) {
        saveDemoSession(fallback);
        router.push("/app/home?demo=1");
        return;
      }

      setError(authErrorMessage(apiError));
      setStatus("idle");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitLogin();
  }

  return (
    <IconoirProvider iconProps={{ strokeWidth: 1.7 }}>
      <div ref={formRef}>
        <div className="login-reveal mb-6">
          <div className="login-mark mb-4 inline-flex size-12 items-center justify-center border border-border bg-foreground text-background shadow-[0_16px_40px_rgba(10,10,10,0.18)]">
            <Fingerprint className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-balance text-2xl font-semibold tracking-[-0.025em]">
            Sign in to AegisWeb
          </h2>
          <p className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">
            Enter the control gateway for agent identity, approvals,
            credentials, and receipts.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="login-reveal space-y-2">
            <Label htmlFor="email">Work email</Label>
            <div className="relative group">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground"
                aria-hidden="true"
              />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onFocus={pulseIcon}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 border-border bg-muted/35 pl-11 shadow-inner transition-[border-color,background-color,box-shadow] focus-visible:bg-background"
                placeholder="founder@company.com"
                required
              />
            </div>
          </div>

          <div className="login-reveal space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/register"
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Need access?
              </Link>
            </div>
            <div className="relative group">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground"
                aria-hidden="true"
              />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onFocus={pulseIcon}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 border-border bg-muted/35 pl-11 pr-11 shadow-inner transition-[border-color,background-color,box-shadow] focus-visible:bg-background"
                placeholder="Your password"
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeClosed className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <p
              className="login-reveal border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm leading-6 text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="login-reveal">
            <Button
              type="button"
              onClick={submitLogin}
              className="h-12 w-full justify-between px-4"
              disabled={status === "loading"}
            >
              <span>Continue to gateway</span>
              {status === "loading" ? (
                <RefreshCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </form>

        {demoEnabled ? (
          <>
            <div className="login-reveal my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Demo roles
              </span>
              <Separator className="flex-1" />
            </div>

            <div className="grid gap-2">
              {DEMO_USERS.map((user) => {
                const selected = user.email === email;

                return (
                  <button
                    key={user.email}
                    type="button"
                    onClick={() => {
                      setEmail(user.email);
                      setPassword(DEMO_PASSWORD);
                      setError("");
                    }}
                    className={cn(
                      "login-reveal border p-3 text-left transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-foreground bg-foreground text-background shadow-[0_14px_40px_rgba(10,10,10,0.18)]"
                        : "border-border bg-background",
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">
                        {user.label}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          selected
                            ? "text-background/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {user.email}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-pretty text-xs leading-5",
                        selected
                          ? "text-background/75"
                          : "text-muted-foreground",
                      )}
                    >
                      {user.detail}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </IconoirProvider>
  );
}

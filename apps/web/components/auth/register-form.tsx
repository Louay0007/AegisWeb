"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building,
  Eye,
  EyeClosed,
  Globe,
  IconoirProvider,
  Lock,
  Mail,
  RefreshCircle,
  User,
} from "iconoir-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthSession, authErrorMessage } from "@/lib/auth/auth-session";
import { apiPost } from "@/lib/api/api-client";

gsap.registerPlugin(useGSAP);

export function RegisterForm() {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement | null>(null);
  const { saveApiSession } = useAuthSession();
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationDomain, setOrganizationDomain] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");

  const { contextSafe } = useGSAP(
    () => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion) {
        gsap.set(".register-reveal", {
          autoAlpha: 1,
          y: 0,
          clearProps: "transform,visibility",
        });
        return;
      }

      gsap.fromTo(
        ".register-reveal",
        { autoAlpha: 0, y: 22, filter: "blur(8px)" },
        {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.72,
          ease: "power3.out",
          stagger: 0.05,
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
      ".register-mark",
      { scale: 0.94, rotation: 3 },
      {
        scale: 1,
        rotation: 0,
        duration: 0.42,
        ease: "back.out(2)",
        overwrite: "auto",
      },
    );
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("loading");

    try {
      const data = await apiPost<{
        user: {
          id: string;
          organizationId: string;
          organizationName: string;
          organizationDomain: string;
          email: string;
          name: string;
          role: string;
          status: string;
        };
      }>("/auth/register", {
        email,
        name,
        password,
        organizationName,
        organizationDomain,
      });
      const session = {
        mode: "api" as const,
        user: data.user,
      };
      saveApiSession(session);
      router.push("/app/getting-started");
    } catch (authError) {
      setError(authErrorMessage(authError));
      setStatus("idle");
    }
  }

  return (
    <IconoirProvider iconProps={{ strokeWidth: 1.7 }}>
      <div ref={formRef}>
        <div className="register-reveal mb-6">
          <div className="register-mark mb-4 inline-flex size-12 items-center justify-center border border-border bg-foreground text-background shadow-[0_16px_40px_rgba(10,10,10,0.18)]">
            <Building className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-balance text-2xl font-semibold tracking-[-0.025em]">
            Create your gateway
          </h2>
          <p className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">
            Start a workspace for teams that want web agents to act with visible
            authority.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="register-reveal grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <div className="relative group">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="name"
                  value={name}
                  onFocus={pulseIcon}
                  onChange={(event) => setName(event.target.value)}
                  className="h-12 border-border bg-muted/35 pl-10 shadow-inner transition-[border-color,background-color,box-shadow] focus-visible:bg-background"
                  placeholder="Louay Haddad"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="organizationName">Company</Label>
              <div className="relative group">
                <Building
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="organizationName"
                  value={organizationName}
                  onFocus={pulseIcon}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  className="h-12 border-border bg-muted/35 pl-11 shadow-inner transition-[border-color,background-color,box-shadow] focus-visible:bg-background"
                  placeholder="Northstar Labs"
                  required
                />
              </div>
            </div>
          </div>

          <div className="register-reveal space-y-2">
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
                placeholder="you@company.com"
                required
              />
            </div>
          </div>

          <div className="register-reveal space-y-2">
            <Label htmlFor="organizationDomain">Organization domain</Label>
            <div className="relative group">
              <Globe
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground"
                aria-hidden="true"
              />
              <Input
                id="organizationDomain"
                value={organizationDomain}
                onFocus={pulseIcon}
                onChange={(event) => setOrganizationDomain(event.target.value)}
                className="h-12 border-border bg-muted/35 pl-11 shadow-inner transition-[border-color,background-color,box-shadow] focus-visible:bg-background"
                placeholder="company.com"
                required
              />
            </div>
          </div>

          <div className="register-reveal space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative group">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground"
                aria-hidden="true"
              />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onFocus={pulseIcon}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 border-border bg-muted/35 pl-11 pr-11 shadow-inner transition-[border-color,background-color,box-shadow] focus-visible:bg-background"
                minLength={8}
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
            <p className="text-xs leading-5 text-muted-foreground">
              Use at least 8 characters. Passwords protect owner access to
              policy and credential controls.
            </p>
          </div>

          {error ? (
            <p
              className="register-reveal border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm leading-6 text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="register-reveal">
            <Button
              type="submit"
              className="h-12 w-full justify-between px-4"
              disabled={status === "loading"}
            >
              <span>Create workspace</span>
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

        <p className="register-reveal mt-5 text-center text-sm text-muted-foreground">
          Already have access?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground transition-colors hover:text-muted-foreground"
          >
            Sign in
          </Link>
        </p>
      </div>
    </IconoirProvider>
  );
}

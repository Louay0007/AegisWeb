"use client";

import { type ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth/auth-session";
import { SideNav } from "./side-nav";
import { TopBar } from "./top-bar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const { state } = useAuthSession();

  if (state.status === "booting") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
        <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Protected gateway</p>
          <h1 className="mt-3 text-balance text-2xl font-semibold tracking-normal">Checking session</h1>
          <p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground">AegisWeb is verifying your access token.</p>
        </div>
      </main>
    );
  }

  if (state.status === "unauthenticated" || state.status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
        <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Protected gateway</p>
          <h1 className="mt-3 text-balance text-2xl font-semibold tracking-normal">Your session is not active</h1>
          <p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground">
            {state.status === "error" ? state.message : "Sign in to open the AegisWeb control gateway."}
          </p>
          <Button asChild className="mt-6 h-10">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background"
      >
        Skip to main content
      </a>
      <SideNav />
      <div className="lg:pl-64">
        <TopBar session={state.session} />
        <main id="app-main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

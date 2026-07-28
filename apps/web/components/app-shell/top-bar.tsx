"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, RefreshCw, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardGlobalSearch } from "@/components/dashboard/dashboard-global-search";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { HelpMenu } from "@/components/support/help-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type AuthSession, useAuthSession } from "@/lib/auth/auth-session";
import { approvals as approvalsFixture } from "@/lib/fixtures/dashboard";
import { pickItems, useApprovals } from "@/lib/data-layer";
import { cn } from "@/lib/utils";
import { MobileNav } from "./mobile-nav";
import { pageTitleForPath } from "./nav-items";

const chromeIconButtonClass =
  "size-10 dark:border-white/25 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white";

type TopBarProps = {
  session: AuthSession | null;
};

export function TopBar({ session }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut: signOutSession } = useAuthSession();
  const approvalItems = pickItems(useApprovals(), approvalsFixture);
  const pendingApprovalCount = approvalItems.filter(
    (approval) => approval.status === "pending",
  ).length;
  const title = pageTitleForPath(pathname);
  const initials = session?.user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function signOut() {
    await signOutSession();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/86 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <MobileNav />
          <div className="min-w-0">
            <p className="hidden text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground sm:block">
              AegisWeb
            </p>
            <p className="truncate text-lg font-semibold tracking-normal">
              {title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DashboardGlobalSearch />
          <HelpMenu />
          <ThemeToggle />
          <Button
            variant="outline"
            size="icon"
            className={chromeIconButtonClass}
            aria-label="Refresh current page"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="size-[1.125rem]" strokeWidth={1.75} />
          </Button>
          <Button
            asChild
            variant="outline"
            className={cn(
              "hidden h-10 gap-2 px-3 sm:inline-flex",
              "dark:border-white/25 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white",
            )}
            aria-label="Pending approvals"
          >
            <a href="/app/approvals">
              <Bell className="size-[1.125rem]" strokeWidth={1.75} />
              <span className="text-sm tabular-nums">{pendingApprovalCount}</span>
            </a>
          </Button>
          {session?.mode === "demo" ? (
            <span className="hidden rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 sm:inline-flex">
              Demo data
            </span>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-10 gap-2 px-2.5 pr-3",
                  "dark:border-white/25 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white",
                )}
                aria-label="Open user menu"
              >
                <span className="inline-flex size-7 items-center justify-center rounded-lg bg-foreground text-xs font-semibold text-background dark:bg-white dark:text-black">
                  {initials ? initials : <User className="size-4" strokeWidth={1.75} />}
                </span>
                <span className="hidden max-w-32 truncate text-sm md:inline">
                  {session?.user.name ?? "Guest"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <span className="block truncate">
                  {session?.user.name ?? "Guest"}
                </span>
                <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                  {session?.user.email ?? "No active session"}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <User className="size-4" strokeWidth={1.75} />
                {session?.user.role ?? "Anonymous"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} variant="destructive">
                <LogOut className="size-4" strokeWidth={1.75} />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

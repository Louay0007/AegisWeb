"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";
import { appNavItems } from "./nav-items";

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Link href="/" className="text-lg font-medium tracking-tight">
          <BrandLogo variant="inverted" className="h-9 w-40" />
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Product navigation">
        {appNavItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/app/home" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium tracking-tight transition-[background-color,color,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:opacity-80",
              )}
            >
              <item.icon
                className="size-[1.125rem] shrink-0"
                strokeWidth={active ? 2 : 1.75}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/55 p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/45">
            Gateway status
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-sidebar-foreground">Authority live</span>
            <span
              className="size-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.22)]"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

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

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Product navigation">
        {appNavItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/app/home" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" strokeWidth={active ? 2 : 1.7} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent/50 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-sidebar-foreground/50">Gateway status</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Authority live</span>
            <span className="size-2 rounded-full bg-sidebar-primary" aria-hidden="true" />
          </div>
        </div>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "iconoir-react";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { appNavItems } from "./nav-items";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-4" strokeWidth={1.8} />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[20rem] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetHeader className="border-b border-sidebar-border p-5 text-left">
          <SheetTitle className="text-sidebar-foreground">
            <BrandLogo variant="inverted" className="h-9 w-40" />
          </SheetTitle>
        </SheetHeader>
        <nav
          className="space-y-1 px-3 py-4"
          aria-label="Mobile product navigation"
        >
          {appNavItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/app/home" &&
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon
                  className="size-4 shrink-0"
                  strokeWidth={active ? 2 : 1.7}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

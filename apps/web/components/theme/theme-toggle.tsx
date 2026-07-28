"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dark = mounted && resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        "relative size-10 text-foreground",
        // Dark mode: keep the control and glyph clearly white on the chrome.
        "dark:border-white/25 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white",
      )}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      disabled={!mounted}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <Sun
        aria-hidden="true"
        strokeWidth={1.75}
        className={cn(
          "size-[1.125rem] transition-[transform,opacity] duration-200 ease-out",
          dark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
        )}
      />
      <Moon
        aria-hidden="true"
        strokeWidth={1.75}
        className={cn(
          "absolute size-[1.125rem] text-white transition-[transform,opacity] duration-200 ease-out",
          dark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0",
        )}
      />
    </Button>
  );
}

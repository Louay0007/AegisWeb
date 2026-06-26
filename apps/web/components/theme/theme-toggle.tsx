"use client";

import { useTheme } from "next-themes";
import { HalfMoon, SunLight } from "iconoir-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <SunLight className="size-4" aria-hidden="true" /> : <HalfMoon className="size-4" aria-hidden="true" />}
    </Button>
  );
}

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Bot,
  Building2,
  CircleHelp,
  Compass,
  FileText,
  Home,
  KeyRound,
  ListChecks,
  ScrollText,
  Settings2,
  ShieldCheck,
  Workflow,
} from "lucide-react";

export type AppNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

/**
 * SF Symbols–style Lucide set: one icon per destination, matched to the label meaning.
 * Keep stroke at ~1.75 in the nav for an iOS weight.
 */
export const appNavItems: AppNavItem[] = [
  { label: "Home", href: "/app/home", icon: Home },
  { label: "Getting Started", href: "/app/getting-started", icon: Compass },
  { label: "Agents", href: "/app/agents", icon: Bot },
  { label: "Policies", href: "/app/policies", icon: ShieldCheck },
  { label: "Credentials", href: "/app/credentials", icon: KeyRound },
  { label: "Vendors", href: "/app/vendors", icon: Building2 },
  { label: "Workflows", href: "/app/workflows", icon: Workflow },
  { label: "Runs", href: "/app/runs", icon: ListChecks },
  { label: "Approvals", href: "/app/approvals", icon: BadgeCheck },
  { label: "Receipts", href: "/app/receipts", icon: FileText },
  { label: "Audit", href: "/app/audit", icon: ScrollText },
  { label: "Help", href: "/app/help", icon: CircleHelp },
  { label: "Settings", href: "/app/settings", icon: Settings2 },
];

export function pageTitleForPath(pathname: string) {
  const exact = appNavItems.find((item) => pathname === item.href);

  if (exact) {
    return exact.label;
  }

  const nested = appNavItems
    .filter((item) => item.href !== "/app/home")
    .find((item) => pathname.startsWith(`${item.href}/`));

  return nested?.label ?? "Gateway";
}

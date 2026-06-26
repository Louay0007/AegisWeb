import {
  Building,
  CheckCircle,
  DashboardDots,
  GitBranch,
  Key,
  Page,
  Book,
  SettingsProfiles,
  Compass,
  ShieldCheck,
  TaskList,
  UserBadgeCheck,
} from "iconoir-react";

export const appNavItems = [
  { label: "Home", href: "/app/home", icon: DashboardDots },
  { label: "Getting Started", href: "/app/getting-started", icon: Compass },
  { label: "Agents", href: "/app/agents", icon: UserBadgeCheck },
  { label: "Policies", href: "/app/policies", icon: ShieldCheck },
  { label: "Credentials", href: "/app/credentials", icon: Key },
  { label: "Vendors", href: "/app/vendors", icon: Building },
  { label: "Workflows", href: "/app/workflows", icon: GitBranch },
  { label: "Runs", href: "/app/runs", icon: TaskList },
  { label: "Approvals", href: "/app/approvals", icon: CheckCircle },
  { label: "Receipts", href: "/app/receipts", icon: Page },
  { label: "Audit", href: "/app/audit", icon: TaskList },
  { label: "Help", href: "/app/help", icon: Book },
  { label: "Settings", href: "/app/settings", icon: SettingsProfiles },
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

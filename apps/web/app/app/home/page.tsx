import type { Metadata } from "next";

import { HomeDashboard } from "@/components/dashboard/home-dashboard";

export const metadata: Metadata = {
  title: "Gateway | AegisWeb",
  description: "AegisWeb authenticated control gateway.",
};

export default function AppHomePage() {
  return <HomeDashboard />;
}
